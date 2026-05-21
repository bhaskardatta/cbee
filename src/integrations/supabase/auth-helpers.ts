// Safari/iOS-hardened session verification helper.
// Lives outside client.ts because client.ts is auto-generated.
import { supabase } from "./client";

export const getVerifiedSession = async () => {
  // Fast path: in-memory / localStorage session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user?.id) return session;

  // Fallback for iOS Safari ITP: verify via server
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) return null;

  // Try to refresh to repopulate localStorage
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (refreshed) return refreshed;

  // Minimal session-shaped object so callers can read user.id
  return {
    user,
    access_token: "",
    refresh_token: "",
    expires_at: 0,
    expires_in: 0,
    token_type: "bearer",
  } as any;
};