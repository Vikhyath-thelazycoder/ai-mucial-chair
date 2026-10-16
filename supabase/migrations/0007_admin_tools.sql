-- Admin tools (P4): remove a registration from the current game, e.g. someone who took another
-- student's USN (SECURITY.md T17). Removing frees the USN and phone for the real player.

create or replace function public.remove_player(p_player_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  perform private.require_reason(p_reason);
  delete from public.players where id = p_player_id and session_id = private.current_session_id();
  if not found then
    perform private.fail('NOT_FOUND');
  end if;
  perform private.audit('remove_player', p_player_id::text, p_reason);
  perform private.refresh_public_state();
end;
$$;

revoke all on function public.remove_player(uuid, text) from public, anon;
grant execute on function public.remove_player(uuid, text) to authenticated;
