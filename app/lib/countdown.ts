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
