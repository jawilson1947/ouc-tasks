/**
 * Supabase Browser client — for Client Components.
 *
 * Use inside any file marked `"use client"`. Manages session cookies on the
 * browser; safe to call repeatedly (returns a cached client).
 */
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
