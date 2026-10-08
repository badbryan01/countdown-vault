export function getCountdown(now: number, start: number, target: number) {
  const remaining = Math.max(0, Math.ceil((target - now) / 1000));
  const progress = target <= start
    ? (now >= target ? 100 : 0)
    : Math.min(100, Math.max(0, ((now - start) / (target - start)) * 100));
  return {
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    progress,
    complete: now >= target,
  };
}

export function getProgressColor(progress: number) {
  const stops = [
    { at: 0, hue: 145 },
    { at: 50, hue: 48 },
    { at: 75, hue: 25 },
    { at: 95, hue: 0 },
    { at: 100, hue: 0 },
  ];
  const value = Math.min(100, Math.max(0, progress));
  const index = stops.findIndex((stop) => stop.at >= value);
  const right = stops[index];
  const left = stops[Math.max(0, index - 1)];
  const fraction = right.at === left.at ? 0 : (value - left.at) / (right.at - left.at);
  return `hsl(${left.hue + (right.hue - left.hue) * fraction} 76% 60%)`;
}

export const progressMilestones = [25, 50, 75, 90] as const;
const percentageFormatter = new Intl.NumberFormat("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function getProgressPercentages(progress: number) {
  const tenths = Math.round(Math.min(100, Math.max(0, progress)) * 10);
  return {
    elapsed: percentageFormatter.format(tenths / 10),
    remaining: percentageFormatter.format((1000 - tenths) / 10),
  };
}

function describeDuration(milliseconds: number) {
  if (milliseconds >= 86400000) return { count: Math.floor(milliseconds / 86400000), unit: "día", plural: "días" };
  if (milliseconds >= 3600000) return { count: Math.floor(milliseconds / 3600000), unit: "hora", plural: "horas" };
  return { count: Math.floor(milliseconds / 60000), unit: "minuto", plural: "minutos" };
}

export function getTimeSummary(now: number, start: number, target: number) {
  const elapsed = describeDuration(Math.max(0, now - start));
  const remaining = describeDuration(Math.max(0, target - now));
  return {
    elapsed: now < start ? "La cuenta regresiva aún no ha comenzado."
      : elapsed.count === 0 ? "Ha transcurrido menos de un minuto desde que comenzó."
      : `${elapsed.count === 1 ? "Ha transcurrido" : "Han transcurrido"} ${elapsed.count} ${elapsed.count === 1 ? elapsed.unit : elapsed.plural} desde que comenzó.`,
    remaining: now >= target ? "Ya llegaste a tu fecha objetivo."
      : remaining.count === 0 ? "Queda menos de un minuto para tu objetivo."
      : `${remaining.count === 1 ? "Queda" : "Quedan"} ${remaining.count} ${remaining.count === 1 ? remaining.unit : remaining.plural} para tu objetivo.`,
  };
}
