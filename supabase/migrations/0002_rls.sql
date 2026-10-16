-- Row Level Security (SECURITY.md › Authentication and authorization).
-- Players never read questions, attempts, chairs or other players; all writes go through RPCs.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on function private.is_admin() to authenticated;

alter table public.admins enable row level security;
alter table public.games enable row level security;
alter table public.players enable row level security;
alter table public.chairs enable row level security;
alter table public.rounds enable row level security;
alter table public.spins enable row level security;
alter table public.questions enable row level security;
alter table public.attempts enable row level security;
alter table public.alerts enable row level security;
alter table public.public_state enable row level security;
alter table public.admin_audit enable row level security;
alter table public.ai_requests enable row level security;

-- Anonymous visitors only ever read the public projection.
revoke all on all tables in schema public from anon;
grant select on public.public_state to anon;

-- Admin read access
create policy admins_read_admins on public.admins for select to authenticated using (private.is_admin());
create policy admins_read_games on public.games for select to authenticated using (private.is_admin());
create policy admins_read_chairs on public.chairs for select to authenticated using (private.is_admin());
create policy admins_read_rounds on public.rounds for select to authenticated using (private.is_admin());
create policy admins_read_spins on public.spins for select to authenticated using (private.is_admin());
create policy admins_read_attempts on public.attempts for select to authenticated using (private.is_admin());
create policy admins_read_alerts on public.alerts for select to authenticated using (private.is_admin());
create policy admins_read_audit on public.admin_audit for select to authenticated using (private.is_admin());

-- Players: own row only; admins: everyone
create policy players_read_self_or_admin on public.players for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

-- Questions: admins manage the bank directly (answers never leave for players)
create policy admins_all_questions on public.questions for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- Public projection: everyone reads, nobody writes directly
create policy public_state_read on public.public_state for select to anon, authenticated using (true);

-- Writes other than questions happen only inside security-definer RPCs.
revoke insert, update, delete, truncate on
  public.admins, public.games, public.players, public.chairs, public.rounds, public.spins,
  public.attempts, public.alerts, public.public_state, public.admin_audit, public.ai_requests
from authenticated;
