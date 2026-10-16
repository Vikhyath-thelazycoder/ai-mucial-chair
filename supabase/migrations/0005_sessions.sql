-- Game sessions (D-014): the admin's "New game" ends the current game and opens a fresh lobby for the
-- next team. Players belong to one session; chairs and their QR codes are permanent.

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  number int not null unique check (number > 0),
  name text not null default 'AI Musical Chair' check (char_length(name) between 1 and 60),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);
alter table public.game_sessions enable row level security;
revoke all on public.game_sessions from anon;
revoke insert, update, delete, truncate on public.game_sessions from authenticated;
create policy admins_read_sessions on public.game_sessions for select to authenticated using (private.is_admin());

insert into public.game_sessions (number, name) select 1, name from public.games where id = 1;

alter table public.games add column current_session_id uuid references public.game_sessions (id);
update public.games set current_session_id = (select id from public.game_sessions where number = 1) where id = 1;
alter table public.games alter column current_session_id set not null;

-- Players: unique per session, so the next team (or the same student later) can register again.
alter table public.players add column session_id uuid references public.game_sessions (id) on delete cascade;
update public.players set session_id = (select current_session_id from public.games where id = 1);
alter table public.players alter column session_id set not null;
alter table public.players drop constraint players_user_id_key;
alter table public.players drop constraint players_usn_key;
alter table public.players drop constraint players_phone_key;
alter table public.players add constraint players_session_user_key unique (session_id, user_id);
alter table public.players add constraint players_session_usn_key unique (session_id, usn);
alter table public.players add constraint players_session_phone_key unique (session_id, phone);

-- Rounds are numbered within a session.
alter table public.rounds add column session_id uuid references public.game_sessions (id) on delete cascade;
update public.rounds set session_id = (select current_session_id from public.games where id = 1);
alter table public.rounds alter column session_id set not null;
alter table public.rounds drop constraint rounds_number_key;
alter table public.rounds add constraint rounds_session_number_key unique (session_id, number);

create or replace function private.current_session_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select current_session_id from public.games where id = 1;
$$;

-- The caller's player row in the CURRENT session.
create or replace function private.me()
returns public.players
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.players;
begin
  if auth.uid() is null then
    perform private.fail('NOT_AUTHENTICATED');
  end if;
  select * into p from public.players where user_id = auth.uid() and session_id = private.current_session_id();
  if not found then
    perform private.fail('NOT_REGISTERED');
  end if;
  return p;
end;
$$;

create or replace function private.refresh_public_state(p_event text default null, p_event_data jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  sess public.game_sessions;
  r public.rounds;
  s public.spins;
  prev public.public_state;
  seq bigint;
  event jsonb;
begin
  select * into g from public.games where id = 1;
  select * into sess from public.game_sessions where id = g.current_session_id;
  select * into r from public.rounds where id = g.current_round_id;
  if r.id is not null then
    s := private.latest_spin(r.id);
  end if;
  select * into prev from public.public_state where id = 1 for update;

  seq := prev.event_seq;
  event := prev.data -> 'event';
  if p_event is not null then
    seq := seq + 1;
    event := jsonb_build_object('kind', p_event, 'seq', seq) || coalesce(p_event_data, '{}');
  end if;

  update public.public_state set
    event_seq = seq,
    updated_at = now(),
    data = jsonb_build_object(
      'session', jsonb_build_object('number', sess.number, 'startedAt', sess.started_at),
      'game', jsonb_build_object(
        'name', g.name,
        'status', g.status,
        'registrationOpen', g.registration_open,
        'finalChairCount', g.final_chair_count,
        'timerSeconds', g.timer_seconds,
        'autoOpenOnPause', g.auto_open_on_pause
      ),
      'round', case when r.id is null then null else jsonb_build_object(
        'number', r.number, 'difficulty', r.difficulty, 'isFinal', r.is_final,
        'status', r.status, 'timerSeconds', r.timer_seconds) end,
      'spin', case when s.id is null then null else jsonb_build_object(
        'number', s.number, 'phase', s.phase, 'scanOpenedAt', s.scan_opened_at) end,
      'chairs', (
        select coalesce(jsonb_agg(jsonb_build_object('number', c.number, 'holder', lk.name) order by c.number), '[]')
        from public.chairs c
        left join lateral (
          select p.name
          from public.attempts a
          join public.spins sp on sp.id = a.spin_id
          join public.players p on p.id = a.player_id
          where r.id is not null and a.round_id = r.id and a.chair_id = c.id
            and a.result = 'correct' and sp.phase in ('judging', 'closed')
          limit 1
        ) lk on true
        where c.is_active and c.deleted_at is null
      ),
      'playersRemaining', (select count(*) from public.players where session_id = g.current_session_id and status = 'active'),
      'playersTotal', (select count(*) from public.players where session_id = g.current_session_id and status <> 'kicked'),
      'winners', (
        select coalesce(jsonb_agg(jsonb_build_object('rank', final_rank, 'name', name) order by final_rank), '[]')
        from public.players where session_id = g.current_session_id and status = 'winner'
      ),
      'event', event
    )
  where id = 1;
end;
$$;

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
      case when g.status = 'lobby' then 'active' else 'spectator' end
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

create or replace function public.start_round(
  p_difficulty int default null,
  p_timer_seconds int default null,
  p_final boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  r public.rounds;
  n_chairs int;
  n_players int;
  next_number int;
begin
  perform private.require_admin();
  select * into g from public.games where id = 1 for update;
  if g.status not in ('lobby', 'round_complete') then
    perform private.fail('INVALID_TRANSITION');
  end if;
  n_chairs := private.active_chair_count();
  if n_chairs < 1 then
    perform private.fail('NO_CHAIRS');
  end if;
  select count(*) into n_players from public.players where session_id = g.current_session_id and status = 'active';
  if n_players < 1 then
    perform private.fail('NO_PLAYERS');
  end if;
  if p_difficulty is not null and p_difficulty not between 1 and 5 then
    perform private.fail('VALIDATION');
  end if;
  if p_timer_seconds is not null and p_timer_seconds not between 5 and 300 then
    perform private.fail('VALIDATION');
  end if;

  select coalesce(max(number), 0) + 1 into next_number from public.rounds where session_id = g.current_session_id;
  insert into public.rounds (session_id, number, difficulty, timer_seconds, is_final)
  values (
    g.current_session_id,
    next_number,
    coalesce(p_difficulty, least(5, next_number)),
    coalesce(p_timer_seconds, g.timer_seconds),
    coalesce(p_final, false) or n_chairs <= g.final_chair_count
  )
  returning * into r;
  insert into public.spins (round_id, number) values (r.id, 1);
  update public.games set status = 'in_round', current_round_id = r.id, updated_at = now() where id = 1;

  perform private.audit('start_round', r.number::text, null);
  perform private.refresh_public_state('round_start', jsonb_build_object('round', r.number, 'isFinal', r.is_final));
  return jsonb_build_object('roundNumber', r.number, 'difficulty', r.difficulty, 'isFinal', r.is_final, 'chairs', n_chairs);
end;
$$;

create or replace function public.end_round(p_force boolean default false, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  r public.rounds;
  s public.spins;
  n_chairs int;
  eliminated text[];
  finished boolean;
begin
  perform private.require_admin();
  select * into g from public.games where id = 1 for update;
  r := private.active_round();
  s := private.latest_spin(r.id);
  if r.id is null or s.phase = 'scan_open' or (s.phase <> 'judging' and not p_force) then
    perform private.fail('INVALID_TRANSITION');
  end if;
  n_chairs := private.active_chair_count();
  if private.locked_chair_count(r.id) < n_chairs then
    if not p_force then
      perform private.fail('ROUND_NOT_COMPLETE');
    end if;
    if p_reason is null or btrim(p_reason) = '' then
      perform private.fail('VALIDATION');
    end if;
  end if;

  with out as (
    update public.players pl set status = 'eliminated', eliminated_in_round = r.number
    where pl.session_id = g.current_session_id
      and pl.status = 'active'
      and not exists (
        select 1 from public.attempts a
        where a.round_id = r.id and a.player_id = pl.id and a.result = 'correct')
    returning pl.name
  )
  select coalesce(array_agg(name order by name), '{}') into eliminated from out;

  update public.spins set phase = 'closed', closed_at = now() where id = s.id;
  update public.rounds set status = 'complete', ended_at = now() where id = r.id;

  finished := r.is_final or n_chairs <= g.final_chair_count;
  if finished then
    with ranked as (
      select a.player_id,
             row_number() over (order by a.time_ms nulls last, a.answered_at nulls last) as rk
      from public.attempts a
      join public.players pl on pl.id = a.player_id
      where a.round_id = r.id and a.result = 'correct' and pl.status = 'active'
    )
    update public.players pl set status = 'winner', final_rank = ranked.rk
    from ranked where pl.id = ranked.player_id;
    update public.games set status = 'finished', updated_at = now() where id = 1;
  else
    update public.games set status = 'round_complete', updated_at = now() where id = 1;
  end if;

  perform private.audit(case when p_force then 'end_round_forced' else 'end_round' end, r.number::text, p_reason);
  perform private.refresh_public_state(
    case when finished then 'podium' else 'round_over' end,
    jsonb_build_object('round', r.number, 'eliminated', to_jsonb(eliminated)));
  return jsonb_build_object('eliminated', to_jsonb(eliminated), 'finished', finished);
end;
$$;

-- Replays the CURRENT session from its lobby (same players). Use start_new_game for the next team.
create or replace function public.reset_game(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := private.current_session_id();
begin
  perform private.require_admin();
  if p_confirm is distinct from 'RESET' then
    perform private.fail('VALIDATION');
  end if;
  update public.games set current_round_id = null where id = 1;
  delete from public.alerts where player_id in (select id from public.players where session_id = sid);
  delete from public.rounds where session_id = sid; -- cascades to spins and attempts
  update public.players set
    status = case when status = 'kicked' then 'kicked' else 'active' end,
    eliminated_in_round = null,
    final_rank = null
  where session_id = sid;
  update public.games set status = 'lobby', registration_open = true, updated_at = now() where id = 1;
  perform private.audit('reset_game', sid::text, null);
  perform private.refresh_public_state('reset', '{}');
end;
$$;

-- "New game": terminate whatever is running, archive this team's game, open a fresh lobby.
-- Chairs and their QR codes are untouched, so nothing needs reprinting.
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

-- Grants (same rule as 0003): signed-in users only; helpers stay private.
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

alter publication supabase_realtime add table public.game_sessions;

select private.refresh_public_state();
