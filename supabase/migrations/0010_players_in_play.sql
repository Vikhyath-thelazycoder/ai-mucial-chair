-- T-7.1: the projector shows who is actually playing. playersInPlay = distinct players who scanned a chair
-- in the current round (round 1 is open to every registered player, D-016). Same function as 0005 plus that field.

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
end;
$$;

select private.refresh_public_state();
