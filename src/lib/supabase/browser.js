'use client';

import { createBrowserClient } from '@supabase/ssr';

let client;

/** Cliente do navegador (usado só para upload direto ao Storage). */
export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
  }
  return client;
}
