-- Realtime (SYSTEM_WORKFLOW.md › Data flow). Postgres-changes delivery respects RLS, so players and
-- the projector only receive public_state; admins receive everything their policies allow.

alter publication supabase_realtime add table
  public.public_state,
  public.players,
  public.chairs,
  public.spins,
  public.attempts,
  public.alerts;
