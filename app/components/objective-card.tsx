import { LoadingLink as Link } from "./loading-link";
import { ObjectiveStatusAction } from "./objective-status-action";
import { getCountdown, getProgressColor, getProgressPercentages, getTimeSummary, progressMilestones } from "../lib/countdown";
import { formatTargetDate, getSantiagoFields } from "../lib/santiago-time";
import type { ObjectiveRecord } from "../lib/objectives";

export function ProgressBar({ record, now, compact = false }: { record: ObjectiveRecord; now: number; compact?: boolean }) {
  const progress = getCountdown(now, Date.parse(record.started_at), Date.parse(record.target_at)).progress;
  const percentages = getProgressPercentages(progress);
  const summary = getTimeSummary(now, Date.parse(record.started_at), Date.parse(record.target_at));
  return <div className="progress-section">
    {!compact && <div className="progress-milestones" aria-label="Hitos del progreso">{progressMilestones.map((milestone) => <span key={milestone} className={`progress-milestone ${progress >= milestone ? "is-reached" : ""}`} style={{ left: `${milestone}%` }} aria-label={`${milestone} %${progress >= milestone ? " alcanzado" : " pendiente"}`}>{milestone} %</span>)}</div>}
    <div className="progress-track" role="progressbar" aria-label={`Avance de ${record.objective_name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: getProgressColor(progress) }} /></div>
    {!compact && <div className="progress-captions"><span>{record.start_label}</span><span>{record.end_label}</span></div>}
    {record.show_progress_percentage && <div className="progress-percentages"><span>{percentages.elapsed} % transcurrido</span>{!compact && <span>{percentages.remaining} % restante</span>}</div>}
    {!compact && <div className="time-summary"><p>{summary.elapsed}</p><p>{summary.remaining}</p></div>}
  </div>;
}

export function ObjectiveCard({ record, now, compact = false, detail = false, onChanged }: { record: ObjectiveRecord; now: number; compact?: boolean; detail?: boolean; onChanged: (record: ObjectiveRecord) => void }) {
  const countdown = getCountdown(now, Date.parse(record.started_at), Date.parse(record.target_at));
  const units = [{ label: "Días", value: countdown.days }, { label: "Horas", value: countdown.hours }, { label: "Minutos", value: countdown.minutes }, { label: "Segundos", value: countdown.seconds }];
  return <section className={`panel objective-card ${compact ? "compact-card" : "countdown-panel"}`} data-accent={record.accent_theme} aria-labelledby={`objective-${record.id}`}>
    {!compact && <p className="eyebrow">{record.title_text}</p>}
    <h2 className="objective-name" id={`objective-${record.id}`}>{record.objective_name}</h2>
    <p className={compact ? "description" : "target-date"}><time dateTime={record.target_at}>{formatTargetDate(record.target_at)}</time></p>
    <p className="description">{getSantiagoFields(record.target_at).time} · Santiago</p>
    {compact ? <p className="remaining-short">{countdown.complete ? "00 días · 00 horas · 00 minutos" : `${countdown.days} días · ${countdown.hours} horas · ${countdown.minutes} minutos`}</p>
      : <div className="countdown-grid" role="timer" aria-label={`Tiempo restante para ${record.objective_name}`} aria-live="off">{units.map(({ label, value }) => <div className="countdown-unit" key={label}><span className="countdown-number">{String(value).padStart(2, "0")}</span><span className="countdown-label">{label}</span></div>)}</div>}
    <ProgressBar record={record} now={now} compact={compact} />
    <p className="countdown-status">{record.status === "completed" ? "Objetivo logrado ✓" : countdown.complete ? "Fecha alcanzada" : compact ? null : record.message_text}</p>
    <div className="card-actions"><Link className="button button-secondary" href={detail ? `/settings?id=${encodeURIComponent(record.id)}` : `/countdown?id=${encodeURIComponent(record.id)}`}>{detail ? "Editar objetivo" : "Ver objetivo"} <span aria-hidden="true">↗</span></Link></div>
    <ObjectiveStatusAction key={record.status} record={record} onChanged={onChanged} />
  </section>;
}
