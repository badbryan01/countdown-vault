"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AppShell } from "./app-shell";
import { useAuth } from "./auth-provider";
import { LoadingLogo } from "./loading-logo";

export function SessionGate({ children, requireSession }: { children: ReactNode; requireSession: boolean }) {
  const { session, loading, error } = useAuth();
  const router = useRouter();
  const redirect = !loading && !error && Boolean(session) !== requireSession;

  useEffect(() => {
    if (redirect) router.replace(requireSession ? "/" : "/countdown");
  }, [redirect, requireSession, router]);

  if (error) {
    return (
      <AppShell>
        <section className="panel form-panel">
          <p className="auth-error" role="alert">{error}</p>
          <button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Reintentar</button>
        </section>
      </AppShell>
    );
  }

  if (loading || redirect) {
    return <LoadingLogo label={loading ? "Comprobando sesión" : "Cambiando de pantalla"} />;
  }

  return children;
}
