export const timeZone = "America/Santiago";

const currentDateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  timeZone, day: "numeric", month: "long", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function formatCurrentDateTime(timestamp: number) {
  const parts = currentDateTimeFormatter.formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return `${part("day")} de ${part("month")} de ${part("year")}, ${part("hour")}:${part("minute")}:${part("second")}`;
}

const fieldsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function getSantiagoFields(timestamp: string | number) {
  const parts = fieldsFormatter.formatToParts(new Date(timestamp));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((value) => value.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}`, second: part("second") };
}

// Resolve the IANA zone explicitly, even when the browser uses another zone.
export function santiagoToIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    throw new Error("Selecciona una fecha y hora válidas.");
  }
  const wallTime = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 16) !== `${date}T${time}`) {
    throw new Error("Selecciona una fecha y hora válidas.");
  }
  const candidates = new Set<number>();
  // Sample both sides of a possible daylight-saving transition.
  for (const hours of [-36, 0, 36]) {
    const sample = wallTime + hours * 3600000;
    const fields = getSantiagoFields(sample);
    const offset = Date.parse(`${fields.date}T${fields.time}:${fields.second}Z`) - sample;
    const candidate = wallTime - offset;
    const roundTrip = getSantiagoFields(candidate);
    if (roundTrip.date === date && roundTrip.time === time) candidates.add(candidate);
  }
  if (!candidates.size) throw new Error("Esa hora no existe en Santiago por el cambio de horario. Elige otra hora.");
  // Repeated autumn times resolve to their first occurrence, like native Date.
  return new Date(Math.min(...candidates)).toISOString();
}

export function formatTargetDate(timestamp: string) {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone, day: "numeric", month: "long", year: "numeric",
  }).format(new Date(timestamp));
}
