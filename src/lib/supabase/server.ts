/**
 * Supabase Server client — for Server Components, Route Handlers, and Server Actions.
 *
 * Reads cookies via next/headers so the user session is honored on the server.
 * Use this in any code that runs server-side and needs to act as the signed-in user.
 *
 * For background data jobs that need to bypass RLS, use the service role key
 * via @supabase/supabase-js directly (see scripts/migrate-tasks.ts).
 */
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if there is middleware refreshing user sessions.
          }
        },
      },
    }
  );
}
