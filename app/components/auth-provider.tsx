"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient } from "../lib/supabase";

type AuthState = {
  session: Session | null;
  loading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true, error: null });

  useEffect(() => {
    let active = true;
    let revision = 0;
    let unsubscribe: (() => void) | undefined;

    async function initialize() {
      try {
        const supabase = getSupabaseClient();
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          revision += 1;
          if (active) setState({ session, loading: false, error: null });
        });
        unsubscribe = () => subscription.unsubscribe();

        const initialRevision = revision;
        const { data, error } = await supabase.auth.getSession();
        // A newer auth event must take precedence over the initial request.
        if (!active || revision !== initialRevision) return;
        if (error) throw error;
        setState({ session: data.session, loading: false, error: null });
      } catch {
        if (active) setState({
          session: null,
          loading: false,
          error: "No se pudo comprobar la sesión. Revisa la conexión y la configuración de Supabase e inténtalo nuevamente.",
        });
      }
    }

    void initialize();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth requiere AuthProvider.");
  return state;
}
