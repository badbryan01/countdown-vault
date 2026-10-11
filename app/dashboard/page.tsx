"use client";

import { useState } from "react";
import { AppShell } from "../components/app-shell";
import { SessionGate } from "../components/session-gate";
import { LoadingLogo } from "../components/loading-logo";
import { LoadingLink as Link } from "../components/loading-link";
import { CurrentClock, useNow } from "../components/current-clock";
import { ObjectiveCard } from "../components/objective-card";
import { ObjectiveStatusAction } from "../components/objective-status-action";
import { useObjectives } from "../lib/use-objectives";
import { getDashboardObjectives, type ObjectiveFilter } from "../lib/objectives";
import { formatTargetDate } from "../lib/santiago-time";
import { formatDuration } from "../lib/countdown";

const filters: { value: ObjectiveFilter; label: string }[] = [{ value: "all", label: "Todos" }, { value: "active", label: "Activos" }, { value: "reached", label: "Fecha alcanzada" }, { value: "completed", label: "Logrados" }];
export default function DashboardPage() {
  return <SessionGate requireSession><DashboardContent /></SessionGate>;
}
function DashboardContent() {
  const { records, loading, error, retry, replaceRecord } = useObjectives();
  const now = useNow();
  const [filter, setFilter] = useState<ObjectiveFilter>("all");
  if (loading || now === null) return <LoadingLogo label="Cargando tus objetivos" />;
  const data = getDashboardObjectives(records, now, filter);
  return <AppShell internal><div className="dashboard-view">
    <CurrentClock now={now} />
    <div className="dashboard-heading"><div><p className="eyebrow">TUS MOMENTOS</p><h1>Dashboard</h1></div><Link className="button button-primary" href="/settings">+ Nuevo objetivo</Link></div>
    {error ? <section className="panel empty-panel"><p className="auth-error" role="alert">{error}</p><button className="button button-secondary state-button" onClick={retry}>Reintentar</button></section>
      : records.length === 0 ? <section className="panel empty-panel"><h2>Aún no tienes objetivos.</h2><p className="description">Crea tu primer momento para comenzar.</p><Link className="button button-primary state-button" href="/settings">+ Crear objetivo</Link></section>
      : <>
        <div className="dashboard-summary"><span><strong>{data.active.length}</strong> {data.active.length === 1 ? "objetivo activo" : "objetivos activos"}</span><span><strong>{data.history.length}</strong> {data.history.length === 1 ? "logrado" : "logrados"}</span><p>Próximo objetivo: {data.next ? <><strong>{data.next.objective_name}</strong> — {formatDuration(Date.parse(data.next.target_at) - now)}</> : "Sin fechas futuras"}</p></div>
        <div className="dashboard-filters" role="group" aria-label="Filtrar objetivos">{filters.map((item) => <button className="filter-button" key={item.value} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}</button>)}</div>
        {data.featured && <div className="featured-objective"><p className="section-label">Tu próximo momento</p><ObjectiveCard record={data.featured} now={now} onChanged={replaceRecord} /></div>}
        {data.cards.length > 0 && <section aria-label="Objetivos activos"><h2 className="section-title">{filter === "reached" ? "Fecha alcanzada" : "Objetivos activos"}</h2><div className="objectives-grid">{data.cards.map((record) => <ObjectiveCard key={record.id} record={record} now={now} compact onChanged={replaceRecord} />)}</div></section>}
        {!data.featured && data.cards.length === 0 && filter !== "completed" && <p className="description empty-filter">No hay objetivos en este filtro.</p>}
        {(filter === "all" || filter === "completed") && <section className="objective-history" aria-labelledby="history-title"><h2 id="history-title" className="section-title">Historial de objetivos logrados</h2>
          {data.visibleHistory.length === 0 ? <p className="description">Tus momentos logrados aparecerán aquí.</p> : <div className="history-list">{data.visibleHistory.map((record) => <article className="panel history-item" data-accent={record.accent_theme} key={record.id}><div><h3><span className="history-check" aria-hidden="true">✓ </span>{record.objective_name}</h3><p>Fecha objetivo: <time dateTime={record.target_at}>{formatTargetDate(record.target_at)}</time></p><p>Logrado: <time dateTime={record.completed_at!}>{formatTargetDate(record.completed_at!)}</time></p><p>Duración: {formatDuration(Date.parse(record.completed_at!) - Date.parse(record.started_at))}</p></div><div className="history-actions"><Link className="text-link" href={`/countdown?id=${encodeURIComponent(record.id)}`}>Ver objetivo ↗</Link><ObjectiveStatusAction record={record} onChanged={replaceRecord} /></div></article>)}</div>}
        </section>}
      </>}
  </div></AppShell>;
}
