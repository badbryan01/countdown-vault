"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../components/auth-provider";
import { getSupabaseClient } from "./supabase";
import { loadCountdown, type CountdownRecord } from "./countdowns";

export function useCountdown() {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ userId: string; record: CountdownRecord | null; loading: boolean; error: string | null }>({
    userId: "", record: null, loading: true, error: null,
  });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const record = await loadCountdown(getSupabaseClient(), userId);
        if (active) setState({ userId, record, loading: false, error: null });
      } catch {
        if (active) setState({ userId, record: null, loading: false, error: "No se pudo cargar tu fecha objetivo. Revisa tu conexión e inténtalo nuevamente." });
      }
    }
    void load();
    return () => { active = false; };
  }, [userId, attempt]);

  function retry() {
    setState({ userId, record: null, loading: true, error: null });
    setAttempt((value) => value + 1);
  }

  return { ...state, loading: state.loading || state.userId !== userId, retry, userId };
}
