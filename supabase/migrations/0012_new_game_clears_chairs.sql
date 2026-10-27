-- D-022 (supersedes D-014): "New game" clears every chair, so each game starts with zero chairs and the
-- host adds that game's chairs, numbered from 1 with new QR codes. Chairs are soft-deleted so past
-- attempts keep their chair; only live chairs need a unique number.

alter table public.chairs drop constraint if exists chairs_number_key;
create unique index if not exists chairs_number_live on public.chairs (number) where deleted_at is null;

create or replace function public.create_chairs(p_count int)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  start_number int;
  created jsonb;
begin
  perform private.require_admin();
  if p_count is null or p_count < 1 or p_count > 100 then
    perform private.fail('VALIDATION');
  end if;
  perform private.assert_chairs_editable('{}', false);
  lock table public.chairs in share row exclusive mode;
  select coalesce(max(number), 0) + 1 into start_number from public.chairs where deleted_at is null;
  with ins as (
    insert into public.chairs (number)
    select start_number + g from generate_series(0, p_count - 1) g
    returning id, number
  )
  select jsonb_agg(jsonb_build_object('id', id, 'number', number) order by number) into created from ins;
  perform private.audit('create_chairs', p_count::text, null);
  perform private.refresh_public_state();
  return created;
end;
$$;

-- "New game": terminate whatever is running, archive this team's game, clear the chairs, open a fresh lobby.
create or replace function public.start_new_game(p_confirm text, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  old_session public.game_sessions;
  new_session public.game_sessions;
begin
  perform private.require_admin();
  if p_confirm is distinct from 'NEW GAME' then
    perform private.fail('VALIDATION');
  end if;
  if p_name is not null and char_length(btrim(p_name)) not between 1 and 60 then
    perform private.fail('VALIDATION');
  end if;
  select * into g from public.games where id = 1 for update;
  select * into old_session from public.game_sessions where id = g.current_session_id;

  -- Terminate anything still running; unanswered attempts count as timed out.
  update public.attempts set result = 'timed_out', answered_at = coalesce(answered_at, now())
  where result = 'pending' and round_id in (select id from public.rounds where session_id = old_session.id);
  update public.spins set phase = 'closed', closed_at = coalesce(closed_at, now())
  where phase <> 'closed' and round_id in (select id from public.rounds where session_id = old_session.id);
  update public.rounds set status = 'complete', ended_at = coalesce(ended_at, now())
  where session_id = old_session.id and status = 'active';
  update public.game_sessions set ended_at = now() where id = old_session.id;

  -- Zero chairs for the next game; their printed QR codes stop working.
  update public.chairs set deleted_at = now(), is_active = false where deleted_at is null;

  insert into public.game_sessions (number, name)
  values (old_session.number + 1, coalesce(btrim(p_name), g.name))
  returning * into new_session;

  update public.games set
    current_session_id = new_session.id,
    current_round_id = null,
    status = 'lobby',
    registration_open = true,
    name = new_session.name,
    updated_at = now()
  where id = 1;

  perform private.audit('start_new_game', new_session.number::text, null);
  perform private.refresh_public_state('new_game', jsonb_build_object('session', new_session.number));
  return jsonb_build_object('sessionNumber', new_session.number, 'previousSession', old_session.number);
end;
$$;
