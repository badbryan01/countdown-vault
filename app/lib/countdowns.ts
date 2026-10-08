import type { SupabaseClient } from "@supabase/supabase-js";

export const textFields = [
  { key: "title_text", label: "Título principal", maxLength: 60 },
  { key: "start_label", label: "Texto inicio", maxLength: 40 },
  { key: "end_label", label: "Texto objetivo", maxLength: 40 },
  { key: "message_text", label: "Mensaje inferior", maxLength: 160 },
] as const;

export type CountdownTexts = Record<(typeof textFields)[number]["key"], string>;

export const accentThemes = [
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "violet", label: "Violeta" },
  { value: "amber", label: "Ámbar" },
] as const;
export type AccentTheme = (typeof accentThemes)[number]["value"];
export type CountdownSettings = CountdownTexts & {
  objective_name: string;
  show_progress_percentage: boolean;
  accent_theme: AccentTheme;
};

export function validateCountdownSettings(settings: CountdownSettings): CountdownSettings {
  const texts = validateCountdownTexts(settings);
  const name = settings.objective_name?.trim();
  if (!name) throw new Error("El nombre del objetivo no puede quedar vacío.");
  if (name.length > 60) throw new Error("El nombre del objetivo admite hasta 60 caracteres.");
  if (!accentThemes.some((theme) => theme.value === settings.accent_theme)) throw new Error("Selecciona un color de acento válido.");
  if (typeof settings.show_progress_percentage !== "boolean") throw new Error("Selecciona si quieres mostrar el porcentaje de progreso.");
  return { ...texts, objective_name: name, accent_theme: settings.accent_theme, show_progress_percentage: settings.show_progress_percentage };
}

// Initial form values for users who do not yet have a row.
export const defaultTexts: CountdownTexts = {
  title_text: "TU PRÓXIMO MOMENTO",
  start_label: "El inicio",
  end_label: "Tu momento",
  message_text: "Lo que esperas, cada vez más cerca.",
};

export function validateCountdownTexts(texts: CountdownTexts): CountdownTexts {
  const normalized = { ...texts };
  for (const field of textFields) {
    const value = texts[field.key]?.trim();
    if (!value) throw new Error(`El campo «${field.label}» no puede quedar vacío.`);
    if (value.length > field.maxLength) throw new Error(`El campo «${field.label}» admite hasta ${field.maxLength} caracteres.`);
    normalized[field.key] = value;
  }
  return normalized;
}

export type CountdownRecord = CountdownSettings & {
  user_id: string;
  started_at: string;
  target_at: string;
  updated_at: string;
};

async function getUserId(client: SupabaseClient, expectedUserId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== expectedUserId) {
    throw new Error("No se pudo verificar el usuario autenticado.");
  }
  return data.user.id;
}

export async function loadCountdown(client: SupabaseClient, expectedUserId: string): Promise<CountdownRecord | null> {
  const userId = await getUserId(client, expectedUserId);
  return readCountdown(client, userId);
}

async function readCountdown(client: SupabaseClient, userId: string): Promise<CountdownRecord | null> {
  const { data, error } = await client.schema("public").from("countdowns")
    .select("user_id,started_at,target_at,updated_at,title_text,start_label,end_label,message_text,objective_name,show_progress_percentage,accent_theme").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data && (!Number.isFinite(Date.parse(data.started_at)) || !Number.isFinite(Date.parse(data.target_at)) || Date.parse(data.target_at) <= Date.parse(data.started_at))) {
    throw new Error("El registro contiene fechas inválidas.");
  }
  return data;
}

export async function saveCountdown(client: SupabaseClient, expectedUserId: string, targetIso: string, pressedAt: number, settings: CountdownSettings) {
  const normalizedSettings = validateCountdownSettings(settings);
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) throw new Error("Selecciona una fecha y hora válidas.");
  const userId = await getUserId(client, expectedUserId);
  // Read the latest row before writing; compare instants, not ISO spellings.
  const existing = await readCountdown(client, userId);
  const targetChanged = !existing || Date.parse(existing.target_at) !== target;
  if (targetChanged && (target <= pressedAt || target <= Date.now())) throw new Error("La fecha objetivo debe ser posterior al momento actual.");
  const modifiedAt = new Date(pressedAt).toISOString();
  const { error } = await client.schema("public").from("countdowns").upsert({
    user_id: userId,
    started_at: targetChanged ? modifiedAt : existing!.started_at,
    target_at: new Date(target).toISOString(),
    updated_at: modifiedAt,
    ...normalizedSettings,
  }, { onConflict: "user_id" });
  if (error) throw error;
}
