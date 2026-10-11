"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "../components/app-shell";
import { SessionGate } from "../components/session-gate";
import { LoadingLogo } from "../components/loading-logo";
import { LoadingLink as Link } from "../components/loading-link";
import { ObjectiveCard } from "../components/objective-card";
import { CurrentClock, useNow } from "../components/current-clock";
import { useObjectives } from "../lib/use-objectives";

export default function CountdownPage() {
  return <SessionGate requireSession><Suspense fallback={<LoadingLogo label="Cargando objetivo" />}><CountdownContent /></Suspense></SessionGate>;
}
function CountdownContent() {
  const id = useSearchParams().get("id");
  const { record, loading, error, retry, replaceRecord } = useObjectives(id);
  const now = useNow();
  if (loading || now === null) return <LoadingLogo label="Cargando objetivo" />;
  return <AppShell internal accentTheme={record?.accent_theme}>
    {error ? <section className="panel form-panel"><p className="auth-error" role="alert">{error}</p><button className="button button-secondary state-button" onClick={retry}>Reintentar</button></section>
      : record ? <div className="countdown-view"><CurrentClock now={now} /><ObjectiveCard record={record} now={now} detail onChanged={replaceRecord} /></div>
      : <section className="panel form-panel"><p className="description">Este objetivo no está disponible.</p><Link className="button button-secondary state-button" href="/dashboard">Volver al Dashboard</Link></section>}
  </AppShell>;
}
