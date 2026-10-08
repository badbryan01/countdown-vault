"use client";

import { LoadingLink as Link } from "../components/loading-link";
import { useEffect, useState } from "react";
import { AppShell } from "../components/app-shell";
import { SessionGate } from "../components/session-gate";
import { LogoutButton } from "../components/logout-button";
import { getCountdown, getProgressColor, getProgressPercentages, getTimeSummary, progressMilestones } from "../lib/countdown";
import { useCountdown } from "../lib/use-countdown";
import { formatCurrentDateTime, formatTargetDate, getSantiagoFields } from "../lib/santiago-time";
import type { CountdownRecord } from "../lib/countdowns";
import { LoadingLogo } from "../components/loading-logo";

export default function CountdownPage() {
  return <SessionGate requireSession><CountdownContent /></SessionGate>;
}

function CountdownContent() {
  const { record, loading, error, retry } = useCountdown();
  if (loading) return <LoadingLogo label="Cargando tu fecha objetivo" />;
  return (
    <AppShell action={<LogoutButton />} accentTheme={record?.accent_theme}>
      {error ? <section className="panel form-panel"><p className="auth-error" role="alert">{error}</p><button className="button button-secondary state-button" onClick={retry}>Reintentar</button></section>
        : record ? <CountdownDisplay record={record} />
        : <section className="panel form-panel"><p className="description">Aún no has definido una fecha objetivo.</p><Link className="button button-primary state-button" href="/settings">Definir fecha</Link></section>}
    </AppShell>
  );
}

function CountdownDisplay({ record }: { record: CountdownRecord }) {
  const start = Date.parse(record.started_at);
  const target = Date.parse(record.target_at);
  const targetLabel = formatTargetDate(record.target_at);
  // Stable initial markup avoids build-time dates and hydration mismatches.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, []);

  const countdown = now === null ? null : getCountdown(now, start, target);
  const units = [
    { label: "Días", value: countdown?.days },
    { label: "Horas", value: countdown?.hours },
    { label: "Minutos", value: countdown?.minutes },
    { label: "Segundos", value: countdown?.seconds },
  ];

  if (now === null) return <LoadingLogo label="Preparando tu cuenta regresiva" />;
  const percentages = getProgressPercentages(countdown!.progress);
  const summary = getTimeSummary(now, start, target);

  return (
    <div className="countdown-view">
      <p className="current-clock" aria-live="off">
        <span>Fecha actual: </span>
        <time dateTime={new Date(now).toISOString()}>{formatCurrentDateTime(now)}</time>
      </p>
      <section className="panel countdown-panel" aria-labelledby="countdown-title">
        <p className="eyebrow">{record.title_text}</p>
        <p className="objective-name">{record.objective_name}</p>
        <h1 id="countdown-title"><time dateTime={record.target_at}>{targetLabel}</time></h1>
        <p className="description">{getSantiagoFields(record.target_at).time} · Hora de Chile (Santiago)</p>
        <div className="countdown-grid" role="timer" aria-label="Tiempo restante" aria-live="off">
          {units.map(({ label, value }) => (
            <div className="countdown-unit" key={label}>
              <span className="countdown-number">{value === undefined ? "—" : String(value).padStart(2, "0")}</span>
              <span className="countdown-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="progress-section">
          <div className="progress-milestones" aria-label="Hitos del progreso">
            {progressMilestones.map((milestone) => (
              <span key={milestone} className={`progress-milestone ${countdown!.progress >= milestone ? "is-reached" : ""}`} style={{ left: `${milestone}%` }} aria-label={`${milestone} %${countdown!.progress >= milestone ? " alcanzado" : " pendiente"}`}>{milestone} %</span>
            ))}
          </div>
          <div className="progress-track" role="progressbar" aria-label="Avance hacia la fecha objetivo" aria-valuemin={0} aria-valuemax={100} aria-valuenow={countdown?.progress} aria-valuetext={countdown ? `${Math.round(countdown.progress)}% transcurrido` : "Cargando"}>
            <div className="progress-fill" style={{ width: `${countdown?.progress ?? 0}%`, backgroundColor: getProgressColor(countdown?.progress ?? 0) }} />
          </div>
          <div className="progress-captions"><span>{record.start_label}</span><span>{record.end_label}</span></div>
          {record.show_progress_percentage && <div className="progress-percentages" aria-live="off"><span>{percentages.elapsed} % transcurrido</span><span>{percentages.remaining} % restante</span></div>}
          <div className="time-summary" aria-live="off"><p>{summary.elapsed}</p><p>{summary.remaining}</p></div>
        </div>
        <p className="countdown-status" role="status">{countdown?.complete ? "Llegó el momento." : record.message_text}</p>
        <Link className="button button-secondary" href="/settings">Cambiar fecha <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
