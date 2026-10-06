"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "../lib/supabase";
import { LoadingLogo } from "./loading-logo";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function logout() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
      router.replace("/");
    } catch {
      setError("No se pudo cerrar la sesión. Inténtalo nuevamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="logout-action">
      {pending && <LoadingLogo variant="overlay" label="Cerrando sesión" />}
      <button className="text-link logout-button" type="button" disabled={pending} onClick={logout}>Cerrar sesión</button>
      {error && <p className="auth-error logout-error" role="alert">{error}</p>}
    </div>
  );
}
