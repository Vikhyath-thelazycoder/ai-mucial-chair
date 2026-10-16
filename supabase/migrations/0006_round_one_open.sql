-- D-016: registering doesn't put you in the game, scanning does. Late registrations stay playable during
-- round 1; my_status tells a player whether they ever scanned, so "never played" isn't shown as eliminated.

create or replace function public.register_player(p_name text, p_usn text, p_phone text, p_branch text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  p public.players;
  constraint_name text;
begin
  if auth.uid() is null then
    perform private.fail('NOT_AUTHENTICATED');
  end if;
  select * into g from public.games where id = 1;
  if exists (select 1 from public.players where user_id = auth.uid() and session_id = g.current_session_id) then
    perform private.fail('ALREADY_REGISTERED');
  end if;
  if not g.registration_open then
    perform private.fail('REGISTRATION_CLOSED');
  end if;

  begin
    insert into public.players (session_id, user_id, name, usn, phone, branch, status)
    values (
      g.current_session_id,
      auth.uid(),
      btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')),
      upper(btrim(coalesce(p_usn, ''))),
      btrim(coalesce(p_phone, '')),
      btrim(coalesce(p_branch, '')),
      -- D-016: anyone registered can play round 1; from round 2 on only round-1 chair holders continue.
      case
        when g.status = 'lobby' then 'active'
        when g.status = 'in_round' and exists (
          select 1 from public.rounds r where r.id = g.current_round_id and r.number = 1 and r.status = 'active') then 'active'
        else 'spectator'
      end
    )
    returning * into p;
  exception
    when unique_violation then
      get stacked diagnostics constraint_name = constraint_name;
      if constraint_name like '%usn%' then
        perform private.fail('DUPLICATE_USN');
      elsif constraint_name like '%phone%' then
        perform private.fail('DUPLICATE_PHONE');
      else
        perform private.fail('ALREADY_REGISTERED');
      end if;
    when check_violation then
      perform private.fail('VALIDATION');
  end;

  perform private.refresh_public_state();
  return jsonb_build_object('id', p.id, 'name', p.name, 'usn', p.usn, 'status', p.status);
end;
$$;

create or replace function public.my_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.players;
  g public.games;
  r public.rounds;
  s public.spins;
  att public.attempts;
  q public.questions;
  chair_number int;
  locked_visible boolean := false;
  played boolean;
  played_before boolean;
begin
  if auth.uid() is null then
    perform private.fail('NOT_AUTHENTICATED');
  end if;
  select * into g from public.games where id = 1;
  select * into p from public.players where user_id = auth.uid() and session_id = g.current_session_id;
  if not found then
    -- playedBefore lets the phone say "a new game has started, register to play" instead of a blank form.
    played_before := exists (select 1 from public.players where user_id = auth.uid());
    return jsonb_build_object('registered', false, 'playedBefore', played_before,
                              'registrationOpen', g.registration_open, 'serverNow', clock_timestamp());
  end if;

  played := exists (select 1 from public.attempts where player_id = p.id);
  r := private.active_round();
  if r.id is not null then
    s := private.latest_spin(r.id);
    locked_visible := exists (
      select 1 from public.attempts a join public.spins sp on sp.id = a.spin_id
      where a.round_id = r.id and a.player_id = p.id and a.result = 'correct' and sp.phase in ('judging', 'closed')
    );
    select * into att from public.attempts where spin_id = s.id and player_id = p.id;
    if att.id is not null then
      select number into chair_number from public.chairs where id = att.chair_id;
      select * into q from public.questions where id = att.question_id;
    end if;
  end if;

  return jsonb_build_object(
    'registered', true,
    'player', jsonb_build_object(
      'name', p.name, 'usn', p.usn, 'branch', p.branch, 'status', p.status,
      'eliminatedInRound', p.eliminated_in_round, 'finalRank', p.final_rank),
    'gameStatus', g.status,
    'roundNumber', r.number,
    'phase', s.phase,
    'lockedThisRound', locked_visible,
    'playedThisGame', played,
    'attempt', case when att.id is null then null else jsonb_build_object(
      'id', att.id,
      'chairNumber', chair_number,
      'deadline', att.deadline,
      'answered', att.result <> 'pending',
      'question', case when att.result = 'pending' then
        jsonb_build_object('id', q.id, 'text', q.text, 'type', q.type, 'options', q.options) else null end
    ) end,
    'serverNow', clock_timestamp()
  );
end;
$$;
