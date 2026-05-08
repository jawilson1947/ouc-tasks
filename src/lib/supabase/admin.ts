/**
 * Service-role Supabase client.
 *
 * BYPASSES RLS — never expose this client to the browser. Intended for
 * Server Actions and route handlers that have already verified the caller
 * is authorized (e.g. is an admin). Always do the role check in your
 * application code BEFORE calling any method on this client.
 */
import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
