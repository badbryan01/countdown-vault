"use client";

import { useEffect, useState } from "react";
import { formatCurrentDateTime } from "../lib/santiago-time";

// One clock per page, passed to all its cards, never one interval per objective.
export function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const initial = window.setTimeout(update, 0);
    const interval = window.setInterval(update, 1000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);
  return now;
}

export function CurrentClock({ now }: { now: number }) {
  return <p className="current-clock" aria-live="off"><span>Fecha actual: </span><time dateTime={new Date(now).toISOString()}>{formatCurrentDateTime(now)}</time></p>;
}
