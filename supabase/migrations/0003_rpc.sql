-- Game logic as security-definer RPCs (D-002). Every function: search_path = '', fully qualified names,
-- checks its caller's role itself, and raises P0001 with a machine-readable code (TRD › APIs).

-- Helpers (private schema: not callable through the API) ---------------------------------------

create or replace function private.fail(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end;
$$;

create or replace function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform private.fail('NOT_AUTHENTICATED');
  end if;
  if not private.is_admin() then
    perform private.fail('NOT_ADMIN');
  end if;
  return auth.uid();
end;
$$;

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
  select * into p from public.players where user_id = auth.uid();
  if not found then
    perform private.fail('NOT_REGISTERED');
  end if;
  return p;
end;
$$;

create or replace function private.normalize(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(regexp_replace(btrim(extensions.unaccent(coalesce(p, ''))), '\s+', ' ', 'g'));
$$;

create or replace function private.audit(p_action text, p_target text, p_reason text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.admin_audit (admin_id, action, target, reason) values (auth.uid(), p_action, p_target, p_reason);
$$;

-- The current active round (null fields when none).
create or replace function private.active_round()
returns public.rounds
language sql
stable
security definer
set search_path = ''
as $$
  select r.* from public.rounds r
  join public.games g on g.current_round_id = r.id
  where r.status = 'active';
$$;

create or replace function private.latest_spin(p_round_id uuid)
returns public.spins
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.spins where round_id = p_round_id order by number desc limit 1;
$$;

create or replace function private.active_chair_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.chairs where is_active and deleted_at is null;
$$;

-- Chairs locked (correct answer) in a round, counting only chairs still in play.
create or replace function private.locked_chair_count(p_round_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int
  from public.attempts a
  join public.chairs c on c.id = a.chair_id
  where a.round_id = p_round_id and a.result = 'correct' and c.is_active and c.deleted_at is null;
$$;

-- Rebuilds the public projection. Locks only become visible once their spin is judged, so
-- nobody (players, projector) learns correctness while the scan window is open.
create or replace function private.refresh_public_state(p_event text default null, p_event_data jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  r public.rounds;
  s public.spins;
  prev public.public_state;
  seq bigint;
  event jsonb;
begin
  select * into g from public.games where id = 1;
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
      'playersRemaining', (select count(*) from public.players where status = 'active'),
      'playersTotal', (select count(*) from public.players where status <> 'kicked'),
      'winners', (
        select coalesce(jsonb_agg(jsonb_build_object('rank', final_rank, 'name', name) order by final_rank), '[]')
        from public.players where status = 'winner'
      ),
      'event', event
    )
  where id = 1;
end;
$$;

-- Chairs can't change while players are scanning, and a chair someone has locked can't be removed mid-round.
create or replace function private.assert_chairs_editable(p_ids uuid[], p_removing boolean)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.rounds;
  s public.spins;
begin
  r := private.active_round();
  if r.id is null then
    return;
  end if;
  s := private.latest_spin(r.id);
  if s.phase = 'scan_open' then
    perform private.fail('INVALID_TRANSITION');
  end if;
  if p_removing and exists (
    select 1 from public.attempts where round_id = r.id and result = 'correct' and chair_id = any (p_ids)
  ) then
    perform private.fail('CHAIR_LOCKED');
  end if;
end;
$$;

-- Player RPCs -----------------------------------------------------------------------------------

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
  if exists (select 1 from public.players where user_id = auth.uid()) then
    perform private.fail('ALREADY_REGISTERED');
  end if;
  select * into g from public.games where id = 1;
  if not g.registration_open then
    perform private.fail('REGISTRATION_CLOSED');
  end if;

  begin
    insert into public.players (user_id, name, usn, phone, branch, status)
    values (
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
begin
  if auth.uid() is null then
    perform private.fail('NOT_AUTHENTICATED');
  end if;
  select * into p from public.players where user_id = auth.uid();
  if not found then
    return jsonb_build_object('registered', false, 'serverNow', clock_timestamp());
  end if;

  select * into g from public.games where id = 1;
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

create or replace function public.claim_chair(p_chair_id uuid, p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.players;
  r public.rounds;
  s public.spins;
  c public.chairs;
  q public.questions;
  att public.attempts;
  constraint_name text;
begin
  p := private.me();
  perform 1 from public.players where id = p.id for update;

  r := private.active_round();
  if r.id is null then
    perform private.fail('SCAN_WINDOW_CLOSED');
  end if;
  s := private.latest_spin(r.id);
  if s.phase is distinct from 'scan_open' then
    perform private.fail('SCAN_WINDOW_CLOSED');
  end if;
  if p.status <> 'active' then
    perform private.fail('NOT_ACTIVE');
  end if;

  -- Serialises concurrent scans of the same chair: the first to commit wins.
  select * into c from public.chairs where id = p_chair_id and deleted_at is null for update;
  if c.id is null
     or extensions.digest(c.secret, 'sha256') <> extensions.digest(coalesce(p_secret, ''), 'sha256') then
    perform private.fail('BAD_QR');
  end if;

  if exists (select 1 from public.attempts where round_id = r.id and player_id = p.id and result = 'correct') then
    perform private.fail('ALREADY_LOCKED');
  end if;
  if exists (select 1 from public.attempts where spin_id = s.id and player_id = p.id) then
    perform private.fail('ALREADY_SCANNED_THIS_SPIN');
  end if;
  if not c.is_active then
    perform private.fail('CHAIR_INACTIVE');
  end if;
  if exists (select 1 from public.attempts where round_id = r.id and chair_id = c.id and result = 'correct') then
    perform private.fail('CHAIR_LOCKED');
  end if;
  if exists (select 1 from public.attempts where spin_id = s.id and chair_id = c.id) then
    perform private.fail('CHAIR_TAKEN');
  end if;

  -- A random question this player hasn't seen, nearest the round's difficulty, preferring one
  -- nobody else got this spin (so neighbours can't share answers).
  select qq.* into q
  from public.questions qq
  where qq.is_enabled
    and not exists (select 1 from public.attempts a where a.player_id = p.id and a.question_id = qq.id)
  order by
    exists (select 1 from public.attempts a where a.spin_id = s.id and a.question_id = qq.id),
    abs(qq.difficulty - r.difficulty),
    random()
  limit 1;
  if q.id is null then
    select qq.* into q from public.questions qq where qq.is_enabled
    order by abs(qq.difficulty - r.difficulty), random() limit 1;
  end if;
  if q.id is null then
    perform private.fail('NO_QUESTIONS');
  end if;

  begin
    insert into public.attempts (spin_id, round_id, chair_id, player_id, question_id, deadline)
    values (s.id, r.id, c.id, p.id, q.id, now() + make_interval(secs => r.timer_seconds))
    returning * into att;
  exception when unique_violation then
    get stacked diagnostics constraint_name = constraint_name;
    if constraint_name like '%player%' then
      perform private.fail('ALREADY_SCANNED_THIS_SPIN');
    else
      perform private.fail('CHAIR_TAKEN');
    end if;
  end;

  return jsonb_build_object(
    'attemptId', att.id,
    'chairNumber', c.number,
    'deadline', att.deadline,
    'serverNow', clock_timestamp(),
    'question', jsonb_build_object('id', q.id, 'text', q.text, 'type', q.type, 'options', q.options)
  );
end;
$$;

create or replace function public.submit_answer(p_attempt_id uuid, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.players;
  att public.attempts;
  q public.questions;
  answered timestamptz := clock_timestamp();
  res text;
begin
  p := private.me();
  select * into att from public.attempts where id = p_attempt_id and player_id = p.id for update;
  if att.id is null then
    perform private.fail('NOT_FOUND');
  end if;
  if att.result <> 'pending' then
    perform private.fail('ALREADY_ANSWERED');
  end if;
  if p_answer is null or char_length(p_answer) > 100 then
    perform private.fail('VALIDATION');
  end if;

  select * into q from public.questions where id = att.question_id;
  if answered > att.deadline + interval '2 seconds' then
    res := 'timed_out';
  elsif q.type = 'mcq' then
    res := case
      when p_answer ~ '^[0-9]$' and (q.options ->> p_answer::int) = q.answer then 'correct'
      else 'wrong' end;
  else
    res := case
      when private.normalize(p_answer) in (
        select private.normalize(x) from unnest(array[q.answer] || q.alternatives) as x) then 'correct'
      else 'wrong' end;
  end if;

  update public.attempts set
    answered_at = answered,
    answer = p_answer,
    result = res,
    time_ms = greatest(0, (extract(epoch from (answered - att.scanned_at)) * 1000)::int)
  where id = att.id;

  -- Never reveal correctness to the player.
  return jsonb_build_object('received', true);
end;
$$;

create or replace function public.report_focus_event(p_attempt_id uuid, p_kind text, p_away_ms int default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.players;
begin
  p := private.me();
  if p_kind not in ('away_start', 'away_end') then
    perform private.fail('VALIDATION');
  end if;
  if p_attempt_id is not null
     and not exists (select 1 from public.attempts where id = p_attempt_id and player_id = p.id) then
    perform private.fail('NOT_FOUND');
  end if;
  -- Cap per attempt so a script can't flood the admin feed.
  if (select count(*) from public.alerts where player_id = p.id and attempt_id is not distinct from p_attempt_id) >= 50 then
    return;
  end if;
  insert into public.alerts (player_id, attempt_id, kind, away_ms)
  values (p.id, p_attempt_id, p_kind,
          case when p_kind = 'away_end' then least(greatest(coalesce(p_away_ms, 0), 0), 3600000) end);
end;
$$;

-- Admin RPCs: settings and chairs ------------------------------------------------------------------

create or replace function public.update_game_settings(
  p_name text default null,
  p_registration_open boolean default null,
  p_final_chair_count int default null,
  p_timer_seconds int default null,
  p_auto_open_on_pause boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  begin
    update public.games set
      name = coalesce(p_name, name),
      registration_open = coalesce(p_registration_open, registration_open),
      final_chair_count = coalesce(p_final_chair_count, final_chair_count),
      timer_seconds = coalesce(p_timer_seconds, timer_seconds),
      auto_open_on_pause = coalesce(p_auto_open_on_pause, auto_open_on_pause),
      updated_at = now()
    where id = 1;
  exception when check_violation then
    perform private.fail('VALIDATION');
  end;
  perform private.audit('update_game_settings', null, null);
  perform private.refresh_public_state();
end;
$$;

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
  select coalesce(max(number), 0) + 1 into start_number from public.chairs;
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

create or replace function public.delete_chairs(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.assert_chairs_editable(p_ids, true);
  -- Soft delete: past attempts keep their chair for the record.
  update public.chairs set deleted_at = now(), is_active = false where id = any (p_ids) and deleted_at is null;
  perform private.audit('delete_chairs', array_to_string(p_ids, ','), null);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.set_chairs_active(p_ids uuid[], p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.assert_chairs_editable(p_ids, not p_active);
  update public.chairs set is_active = p_active where id = any (p_ids) and deleted_at is null;
  perform private.audit(case when p_active then 'activate_chairs' else 'deactivate_chairs' end, array_to_string(p_ids, ','), null);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.rotate_chair_secret(p_chair_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.chairs set secret = encode(extensions.gen_random_bytes(24), 'hex') where id = p_chair_id;
  perform private.audit('rotate_chair_secret', p_chair_id::text, null);
end;
$$;

-- Admin RPCs: game flow ---------------------------------------------------------------------------

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
  select count(*) into n_players from public.players where status = 'active';
  if n_players < 1 then
    perform private.fail('NO_PLAYERS');
  end if;
  if p_difficulty is not null and p_difficulty not between 1 and 5 then
    perform private.fail('VALIDATION');
  end if;
  if p_timer_seconds is not null and p_timer_seconds not between 5 and 300 then
    perform private.fail('VALIDATION');
  end if;

  select coalesce(max(number), 0) + 1 into next_number from public.rounds;
  insert into public.rounds (number, difficulty, timer_seconds, is_final)
  values (
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

create or replace function public.set_round_final(p_final boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
begin
  perform private.require_admin();
  r := private.active_round();
  if r.id is null then
    perform private.fail('INVALID_TRANSITION');
  end if;
  update public.rounds set is_final = p_final where id = r.id;
  perform private.audit('set_round_final', r.number::text, p_final::text);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.open_scan_window()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
  s public.spins;
begin
  perform private.require_admin();
  r := private.active_round();
  s := private.latest_spin(r.id);
  if r.id is null or s.phase is distinct from 'music' then
    perform private.fail('INVALID_TRANSITION');
  end if;
  update public.spins set phase = 'scan_open', scan_opened_at = now() where id = s.id and phase = 'music';
  perform private.refresh_public_state();
end;
$$;

create or replace function public.close_scan_window()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
  s public.spins;
begin
  perform private.require_admin();
  r := private.active_round();
  s := private.latest_spin(r.id);
  if r.id is null or s.phase is distinct from 'scan_open' then
    perform private.fail('INVALID_TRANSITION');
  end if;
  update public.spins set phase = 'judging' where id = s.id;
  -- Anyone who hasn't answered by now counts as wrong.
  update public.attempts set result = 'timed_out', answered_at = coalesce(answered_at, now())
  where spin_id = s.id and result = 'pending';
  perform private.refresh_public_state();
end;
$$;

create or replace function public.next_spin()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
  s public.spins;
begin
  perform private.require_admin();
  r := private.active_round();
  s := private.latest_spin(r.id);
  if r.id is null or s.phase is distinct from 'judging' then
    perform private.fail('INVALID_TRANSITION');
  end if;
  if private.locked_chair_count(r.id) >= private.active_chair_count() then
    perform private.fail('ROUND_COMPLETE');
  end if;
  update public.spins set phase = 'closed', closed_at = now() where id = s.id;
  insert into public.spins (round_id, number) values (r.id, s.number + 1);
  perform private.refresh_public_state();
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

  -- Everyone still standing is out.
  with out as (
    update public.players pl set status = 'eliminated', eliminated_in_round = r.number
    where pl.status = 'active'
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

-- Admin RPCs: overrides (always audited with a reason) ---------------------------------------------

create or replace function private.require_reason(p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_reason is null or btrim(p_reason) = '' or char_length(p_reason) > 200 then
    perform private.fail('VALIDATION');
  end if;
end;
$$;

create or replace function public.override_attempt(p_attempt_id uuid, p_correct boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
begin
  perform private.require_admin();
  perform private.require_reason(p_reason);
  r := private.active_round();
  if r.id is null or not exists (select 1 from public.attempts where id = p_attempt_id and round_id = r.id) then
    perform private.fail('NOT_FOUND');
  end if;
  begin
    update public.attempts
    set result = case when p_correct then 'correct' else 'wrong' end,
        overridden = true,
        answered_at = coalesce(answered_at, now())
    where id = p_attempt_id;
  exception when unique_violation then
    perform private.fail('CHAIR_LOCKED');
  end;
  perform private.audit('override_attempt', p_attempt_id::text, p_reason);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.free_chair(p_chair_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
begin
  perform private.require_admin();
  perform private.require_reason(p_reason);
  r := private.active_round();
  if r.id is null then
    perform private.fail('INVALID_TRANSITION');
  end if;
  update public.attempts set result = 'wrong', overridden = true
  where round_id = r.id and chair_id = p_chair_id and result = 'correct';
  perform private.audit('free_chair', p_chair_id::text, p_reason);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.kick_player(p_player_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.rounds;
begin
  perform private.require_admin();
  perform private.require_reason(p_reason);
  update public.players set status = 'kicked' where id = p_player_id;
  if not found then
    perform private.fail('NOT_FOUND');
  end if;
  r := private.active_round();
  if r.id is not null then
    update public.attempts set result = 'wrong', overridden = true
    where round_id = r.id and player_id = p_player_id and result in ('correct', 'pending');
  end if;
  perform private.audit('kick_player', p_player_id::text, p_reason);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.restore_player(p_player_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.require_reason(p_reason);
  update public.players set status = 'active', eliminated_in_round = null, final_rank = null where id = p_player_id;
  if not found then
    perform private.fail('NOT_FOUND');
  end if;
  perform private.audit('restore_player', p_player_id::text, p_reason);
  perform private.refresh_public_state();
end;
$$;

create or replace function public.acknowledge_alert(p_alert_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  update public.alerts set acknowledged = true where id = p_alert_id;
end;
$$;

create or replace function public.reset_game(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_confirm is distinct from 'RESET' then
    perform private.fail('VALIDATION');
  end if;
  update public.games set current_round_id = null where id = 1;
  delete from public.alerts where true;
  delete from public.attempts where true;
  delete from public.spins where true;
  delete from public.rounds where true;
  update public.players set
    status = case when status = 'kicked' then 'kicked' else 'active' end,
    eliminated_in_round = null,
    final_rank = null
  where true;
  update public.games set status = 'lobby', registration_open = true, updated_at = now() where id = 1;
  perform private.audit('reset_game', null, null);
  perform private.refresh_public_state('reset', '{}');
end;
$$;

-- Grants: only signed-in users may call RPCs (each checks its own role); helpers stay private. ------

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

select private.refresh_public_state();
