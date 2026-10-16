-- The 50-alerts-per-attempt cap (SECURITY.md T12) raced under concurrent reports (55 parallel calls
-- inserted 53). Serialise reports per player + attempt with a transaction-scoped advisory lock.

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
  perform pg_advisory_xact_lock(hashtextextended(p.id::text || coalesce(p_attempt_id::text, ''), 0));
  if (select count(*) from public.alerts where player_id = p.id and attempt_id is not distinct from p_attempt_id) >= 50 then
    return;
  end if;
  insert into public.alerts (player_id, attempt_id, kind, away_ms)
  values (p.id, p_attempt_id, p_kind,
          case when p_kind = 'away_end' then least(greatest(coalesce(p_away_ms, 0), 0), 3600000) end);
end;
$$;
