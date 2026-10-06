"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

// Call from browser event handlers or effects when Supabase is integrated.
// Lazy initialization lets static builds succeed with empty environment values.
export function getSupabaseClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("El cliente de Supabase solo debe inicializarse en el navegador.");
  }

  if (client) return client;

  // Direct references are required for Next.js to inline public values at build time.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY en .env.local antes de utilizar Supabase.",
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // This app currently supports only email/password login.
      detectSessionInUrl: false,
    },
  });

  return client;
}
