-- Projector seats (live 3D stage). A chair shows its occupant as soon as they scan, without saying whether
-- they are right; the admin reveals green/red per spin with reveal_results(). Only /screen subscribes to this
-- table, so a burst of scans doesn't make every phone refetch (players listen to public_state only).

alter table public.spins add column if not exists revealed_at timestamptz;

create table if not exists public.stage_seats (
  chair_id uuid primary key references public.chairs (id) on delete cascade,
  number int not null,
  occupant text,
  state text not null default 'empty' check (state in ('empty', 'seated', 'correct', 'wrong')),
  updated_at timestamptz not null default now()
);
alter table public.stage_seats enable row level security;
revoke all on public.stage_seats from anon, authenticated;
grant select on public.stage_seats to anon, authenticated;
create policy stage_seats_read on public.stage_seats for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.stage_seats;

-- Seat state per active chair:
--   correct  locked by a correct answer in an earlier spin, or in this spin once revealed (green)
--   seated   claimed this spin; result not shown yet (scan window open, or judging before reveal)
--   wrong    this spin's claim was wrong or ran out of time, after reveal (red)
--   empty    nobody (lobby, new round, or a wrong claim once the spin moves on)
create or replace function private.refresh_stage()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.games;
  r public.rounds;
  s public.spins;
begin
  select * into g from public.games where id = 1;
  if g.status <> 'lobby' and g.current_round_id is not null then
    select * into r from public.rounds where id = g.current_round_id;
    s := private.latest_spin(r.id);
  end if;

  delete from public.stage_seats ss
  where not exists (select 1 from public.chairs c where c.id = ss.chair_id and c.is_active and c.deleted_at is null);

  insert into public.stage_seats as ss (chair_id, number, occupant, state, updated_at)
  select c.id, c.number, case when x.state is null then null else x.occupant end, coalesce(x.state, 'empty'), now()
  from public.chairs c
  left join lateral (
    select p.name as occupant,
      case
        when a.result = 'correct' and (a.spin_id <> s.id or s.revealed_at is not null or s.phase = 'closed') then 'correct'
        when a.spin_id = s.id and s.phase = 'scan_open' then 'seated'
        when a.spin_id = s.id and s.phase = 'judging' and s.revealed_at is null then 'seated'
        when a.spin_id = s.id and s.phase = 'judging' then 'wrong'
        else null
      end as state
    from public.attempts a
    join public.players p on p.id = a.player_id
    join public.spins sp on sp.id = a.spin_id
    where r.id is not null and a.round_id = r.id and a.chair_id = c.id
      and (a.spin_id = s.id or (a.result = 'correct' and sp.phase in ('judging', 'closed')))
    order by (a.result = 'correct') desc, a.scanned_at desc
    limit 1
  ) x on true
  where c.is_active and c.deleted_at is null
  on conflict (chair_id) do update set
    number = excluded.number, occupant = excluded.occupant, state = excluded.state, updated_at = now()
  where (ss.number, ss.occupant, ss.state) is distinct from (excluded.number, excluded.occupant, excluded.state);
end;
$$;

-- A scan seats the player straight away (one row, so concurrent scans of different chairs never contend).
create or replace function private.seat_on_claim()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.stage_seats
  set occupant = (select name from public.players where id = new.player_id), state = 'seated', updated_at = now()
  where chair_id = new.chair_id;
  return null;
end;
$$;
drop trigger if exists attempts_seat_on_claim on public.attempts;
create trigger attempts_seat_on_claim after insert on public.attempts
for each row execute function private.seat_on_claim();

-- Admin: show this spin's results on the projector (green / red).
create or replace function public.reveal_results()
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
  update public.spins set revealed_at = coalesce(revealed_at, now()) where id = s.id;
  perform private.audit('reveal_results', s.number::text, null);
  perform private.refresh_public_state();
end;
$$;
revoke all on function public.reveal_results() from public, anon;
grant execute on function public.reveal_results() to authenticated;
revoke all on function private.refresh_stage() from public, anon, authenticated;
revoke all on function private.seat_on_claim() from public, anon, authenticated;

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
        'number', s.number, 'phase', s.phase, 'scanOpenedAt', s.scan_opened_at,
        'revealed', s.revealed_at is not null) end,
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
      'playersInPlay', (
        select count(distinct a.player_id)
        from public.attempts a
        join public.players p on p.id = a.player_id
        where r.id is not null and a.round_id = r.id and p.status <> 'kicked'
      ),
      'winners', (
        select coalesce(jsonb_agg(jsonb_build_object('rank', final_rank, 'name', name) order by final_rank), '[]')
        from public.players where session_id = g.current_session_id and status = 'winner'
      ),
      'event', event
    )
  where id = 1;
  perform private.refresh_stage();
end;
$$;

select private.refresh_public_state();
