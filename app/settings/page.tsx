"use client";

import { LoadingLink as Link } from "../components/loading-link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { AppShell } from "../components/app-shell";
import { SessionGate } from "../components/session-gate";
import { useCountdown } from "../lib/use-countdown";
import { getSantiagoFields, santiagoToIso } from "../lib/santiago-time";
import { saveCountdown, validateCountdownTexts, textFields, defaultTexts, type CountdownTexts, type CountdownRecord } from "../lib/countdowns";
import { getSupabaseClient } from "../lib/supabase";
import { LoadingLogo } from "../components/loading-logo";

export default function SettingsPage() {
  return <SessionGate requireSession><SettingsContent /></SessionGate>;
}

function SettingsContent() {
  const { record, loading, error, retry, userId } = useCountdown();
  if (loading) return <LoadingLogo label="Cargando tu configuración" />;
  return (
    <AppShell>
      {error ? <section className="panel form-panel"><p className="auth-error" role="alert">{error}</p><button className="button button-secondary state-button" onClick={retry}>Reintentar</button><Link className="back-link text-link" href="/countdown">← Volver</Link></section>
        : <SettingsForm key={userId} record={record} userId={userId} />}
    </AppShell>
  );
}

function SettingsForm({ record, userId }: { record: CountdownRecord | null; userId: string }) {
  const router = useRouter();
  const initial = record ? getSantiagoFields(record.target_at) : { date: "", time: "" };
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [texts, setTexts] = useState<CountdownTexts>(() => record ? {
    title_text: record.title_text,
    start_label: record.start_label,
    end_label: record.end_label,
    message_text: record.message_text,
  } : { ...defaultTexts });
  const [saving, setSaving] = useState(false);
  const [navigating, startTransition] = useTransition();
  const processing = saving || navigating;
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const pressedAt = Date.now();
    setError(null);
    let targetIso: string;
    let normalizedTexts: CountdownTexts;
    try {
      targetIso = santiagoToIso(date, time);
      if (Date.parse(targetIso) <= pressedAt) throw new Error("La fecha objetivo debe ser posterior al momento actual.");
      normalizedTexts = validateCountdownTexts(texts);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Selecciona una fecha y hora válidas.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      await saveCountdown(getSupabaseClient(), userId, targetIso, pressedAt, normalizedTexts);
      setSaving(false);
      startTransition(() => router.replace("/countdown"));
    } catch {
      setError("No se pudo guardar la configuración. Comprueba que la fecha siga siendo futura, revisa tu conexión e inténtalo nuevamente.");
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <>
      {processing && <LoadingLogo variant="overlay" label={saving ? "Guardando configuración" : "Cambiando de pantalla"} />}
      <section className="panel form-panel settings-panel" aria-labelledby="settings-title" inert={processing}>
        <p className="eyebrow">ELIGE TU MOMENTO</p>
        <h1 id="settings-title">Fecha objetivo</h1>
        <p className="description">Dale una fecha a lo que esperas.</p>
        <form className="form" onSubmit={save} noValidate aria-busy={processing}>
          <div className="settings-date-grid">
          <div className="field"><label htmlFor="date">Fecha</label><input id="date" name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} disabled={saving} required /></div>
          <div className="field"><label htmlFor="time">Hora</label><input id="time" name="time" type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={saving} required /></div>
          </div>
          <p className="fine-print form-note">Hora de Chile (Santiago). Al guardar, el progreso comienza de nuevo.</p>
          <fieldset className="personalization" disabled={saving}>
            <legend>Personalización</legend>
            <div className="settings-text-grid">
              {textFields.map((field) => (
                <div className={`field ${field.key === "title_text" || field.key === "message_text" ? "full-width" : ""}`} key={field.key}>
                  <label htmlFor={field.key}>{field.label}</label>
                  <input id={field.key} name={field.key} type="text" value={texts[field.key]} onChange={(event) => setTexts((current) => ({ ...current, [field.key]: event.target.value }))} maxLength={field.maxLength} aria-describedby={`${field.key}-hint`} required />
                  <span className="field-hint" id={`${field.key}-hint`}>Máximo {field.maxLength} caracteres.</span>
                </div>
              ))}
            </div>
          </fieldset>
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary" type="submit" disabled={processing}>Guardar <span aria-hidden="true">→</span></button>
          <Link className="back-link text-link" href="/countdown" aria-disabled={saving} onClick={(event) => { if (saving) event.preventDefault(); }}>← Volver</Link>
        </form>
      </section>
    </>
  );
}
