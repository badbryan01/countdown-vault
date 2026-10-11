"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../components/auth-provider";
import { getSupabaseClient } from "./supabase";
import { loadObjective, loadObjectives, type ObjectiveRecord } from "./objectives";

// undefined loads the dashboard; null creates a new objective without a query.
export function useObjectives(id?: string | null) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const requestKey = `${userId}:${id === undefined ? "list" : id ?? "new"}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; records: ObjectiveRecord[]; loading: boolean; error: string | null }>({ key: "", records: [], loading: true, error: null });
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const records = id === undefined ? await loadObjectives(getSupabaseClient(), userId)
          : id === null ? [] : await loadObjective(getSupabaseClient(), userId, id).then((record) => record ? [record] : []);
        if (active) setState({ key: requestKey, records, loading: false, error: null });
      } catch {
        if (active) setState({ key: requestKey, records: [], loading: false, error: "No se pudieron cargar tus objetivos. Revisa tu conexión e inténtalo nuevamente." });
      }
    }
    void load();
    return () => { active = false; };
  }, [userId, id, requestKey, attempt]);
  function retry() {
    setState({ key: requestKey, records: [], loading: true, error: null });
    setAttempt((value) => value + 1);
  }
  function replaceRecord(record: ObjectiveRecord) {
    setState((current) => ({ ...current, records: current.records.map((item) => item.id === record.id ? record : item) }));
  }
  const loading = state.loading || state.key !== requestKey;
  return { records: loading ? [] : state.records, record: loading ? null : state.records[0] ?? null, loading, error: loading ? null : state.error, retry, replaceRecord, userId };
}
