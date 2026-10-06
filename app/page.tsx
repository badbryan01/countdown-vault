"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { AppShell } from "./components/app-shell";
import { SessionGate } from "./components/session-gate";
import { getSupabaseClient } from "./lib/supabase";
import { LoadingLogo } from "./components/loading-logo";

export default function LoginPage() {
  return <SessionGate requireSession={false}><LoginForm /></SessionGate>;
}

function LoginForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [navigating, startTransition] = useTransition();
  const processing = pending || navigating;
  const [error, setError] = useState<string | null>(null);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
      });
      if (error) {
        setError(error.code === "invalid_credentials"
          ? "Correo o contraseña incorrectos."
          : error.code === "email_not_confirmed"
            ? "Debes confirmar tu correo antes de iniciar sesión."
            : "No se pudo iniciar sesión. Inténtalo nuevamente.");
        return;
      }
      if (!data.session) {
        setError("No se pudo iniciar sesión. Inténtalo nuevamente.");
        return;
      }
      startTransition(() => router.replace("/countdown"));
    } catch {
      setError("No se pudo iniciar sesión. Revisa tu conexión e inténtalo nuevamente.");
    } finally {
      setPending(false);
    }
  }
  return (
    <AppShell>
      {processing && <LoadingLogo variant="overlay" label="Iniciando sesión" />}
      <section className="panel form-panel" aria-labelledby="login-title" inert={processing}>
        <p className="eyebrow">TU ESPACIO PERSONAL</p>
        <h1 id="login-title">Cada segundo cuenta.</h1>
        <p className="description">Un lugar para esperar lo que importa.</p>
        <form className="form" onSubmit={login} aria-busy={processing}>
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" name="email" type="email" autoComplete="username" placeholder="tu@correo.com" disabled={pending} required />
          </div>
          <div className="field">
            <label htmlFor="password">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" disabled={pending} required />
          </div>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={processing}>Iniciar sesión <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </AppShell>
  );
}
