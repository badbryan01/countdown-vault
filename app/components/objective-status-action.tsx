"use client";

import { useRef, useState } from "react";
import { changeObjectiveStatus, type ObjectiveRecord } from "../lib/objectives";
import { getSupabaseClient } from "../lib/supabase";
import { LoadingLogo } from "./loading-logo";

export function ObjectiveStatusAction({ record, onChanged }: { record: ObjectiveRecord; onChanged: (record: ObjectiveRecord) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const completed = record.status === "completed";
  async function change() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const updated = await changeObjectiveStatus(getSupabaseClient(), record.user_id, record.id, completed ? "active" : "completed", Date.now());
      onChanged(updated);
      setConfirming(false);
    } catch { setError("No se pudo actualizar el objetivo. Inténtalo nuevamente."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="status-action">
    {busy && <LoadingLogo variant="overlay" label={completed ? "Reabriendo objetivo" : "Marcando objetivo como logrado"} />}
    {confirming ? <div className="confirmation" role="group" aria-label="Confirmar cambio de estado">
      <p>{completed ? "¿Reabrir este objetivo? Su inicio se conservará." : "¿Marcar este objetivo como logrado? Pasará al historial."}</p>
      <div className="card-actions"><button className="button button-secondary" disabled={busy} onClick={change}>Confirmar</button><button className="text-link plain-button" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button></div>
    </div> : <button className="text-link plain-button" onClick={() => setConfirming(true)}>{completed ? "Reabrir" : "Marcar como logrado"}</button>}
    {error && <p className="auth-error" role="alert">{error}</p>}
  </div>;
}
