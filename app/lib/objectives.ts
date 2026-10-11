import type { SupabaseClient } from "@supabase/supabase-js";

export const textFields = [
  { key: "title_text", label: "Título principal", maxLength: 60 },
  { key: "start_label", label: "Texto inicio", maxLength: 40 },
  { key: "end_label", label: "Texto objetivo", maxLength: 40 },
  { key: "message_text", label: "Mensaje inferior", maxLength: 160 },
] as const;

export type ObjectiveTexts = Record<(typeof textFields)[number]["key"], string>;

export const accentThemes = [
  { value: "green", label: "Verde" },
  { value: "blue", label: "Azul" },
  { value: "violet", label: "Violeta" },
  { value: "amber", label: "Ámbar" },
] as const;
export type AccentTheme = (typeof accentThemes)[number]["value"];
export type ObjectiveSettings = ObjectiveTexts & {
  objective_name: string;
  show_progress_percentage: boolean;
  accent_theme: AccentTheme;
};

export function validateObjectiveSettings(settings: ObjectiveSettings): ObjectiveSettings {
  const texts = validateObjectiveTexts(settings);
  const name = settings.objective_name?.trim();
  if (!name) throw new Error("El nombre del objetivo no puede quedar vacío.");
  if (name.length > 60) throw new Error("El nombre del objetivo admite hasta 60 caracteres.");
  if (!accentThemes.some((theme) => theme.value === settings.accent_theme)) throw new Error("Selecciona un color de acento válido.");
  if (typeof settings.show_progress_percentage !== "boolean") throw new Error("Selecciona si quieres mostrar el porcentaje de progreso.");
  return { ...texts, objective_name: name, accent_theme: settings.accent_theme, show_progress_percentage: settings.show_progress_percentage };
}

// Initial form values for users who do not yet have a row.
export const defaultTexts: ObjectiveTexts = {
  title_text: "TU PRÓXIMO MOMENTO",
  start_label: "El inicio",
  end_label: "Tu momento",
  message_text: "Lo que esperas, cada vez más cerca.",
};

export function validateObjectiveTexts(texts: ObjectiveTexts): ObjectiveTexts {
  const normalized = { ...texts };
  for (const field of textFields) {
    const value = texts[field.key]?.trim();
    if (!value) throw new Error(`El campo «${field.label}» no puede quedar vacío.`);
    if (value.length > field.maxLength) throw new Error(`El campo «${field.label}» admite hasta ${field.maxLength} caracteres.`);
    normalized[field.key] = value;
  }
  return normalized;
}

export type ObjectiveRecord = ObjectiveSettings & {
  id: string;
  user_id: string;
  started_at: string;
  target_at: string;
  updated_at: string;
  created_at: string;
  status: "active" | "completed";
  completed_at: string | null;
};

async function getUserId(client: SupabaseClient, expectedUserId: string) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user || data.user.id !== expectedUserId) {
    throw new Error("No se pudo verificar el usuario autenticado.");
  }
  return data.user.id;
}

const columns = "id,user_id,started_at,target_at,created_at,updated_at,status,completed_at,title_text,start_label,end_label,message_text,objective_name,show_progress_percentage,accent_theme";

function validateRecord(data: ObjectiveRecord) {
  if (!Number.isFinite(Date.parse(data.started_at)) || !Number.isFinite(Date.parse(data.target_at)) || Date.parse(data.target_at) <= Date.parse(data.started_at) || !["active", "completed"].includes(data.status) || (data.status === "completed" && !Number.isFinite(Date.parse(data.completed_at ?? "")))) throw new Error("El objetivo contiene datos inválidos.");
  return data;
}

export async function loadObjectives(client: SupabaseClient, expectedUserId: string): Promise<ObjectiveRecord[]> {
  const userId = await getUserId(client, expectedUserId);
  const { data, error } = await client.schema("public").from("objectives").select(columns).eq("user_id", userId).order("target_at");
  if (error) throw error;
  return (data ?? []).map(validateRecord);
}

export async function loadObjective(client: SupabaseClient, expectedUserId: string, id: string): Promise<ObjectiveRecord | null> {
  const userId = await getUserId(client, expectedUserId);
  return readObjective(client, userId, id);
}

async function readObjective(client: SupabaseClient, userId: string, id: string): Promise<ObjectiveRecord | null> {
  const { data, error } = await client.schema("public").from("objectives")
    .select(columns).eq("user_id", userId).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? validateRecord(data) : null;
}

export async function saveObjective(client: SupabaseClient, expectedUserId: string, id: string | null, targetIso: string, pressedAt: number, settings: ObjectiveSettings) {
  const normalizedSettings = validateObjectiveSettings(settings);
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target)) throw new Error("Selecciona una fecha y hora válidas.");
  const userId = await getUserId(client, expectedUserId);
  // Read the latest row before writing; compare instants, not ISO spellings.
  const existing = id ? await readObjective(client, userId, id) : null;
  if (id && !existing) throw new Error("El objetivo ya no está disponible.");
  const targetChanged = !existing || Date.parse(existing.target_at) !== target;
  if (targetChanged && (target <= pressedAt || target <= Date.now())) throw new Error("La fecha objetivo debe ser posterior al momento actual.");
  const modifiedAt = new Date(pressedAt).toISOString();
  const values = {
    started_at: targetChanged ? modifiedAt : existing!.started_at,
    target_at: new Date(target).toISOString(),
    updated_at: modifiedAt,
    ...normalizedSettings,
  };
  const table = client.schema("public").from("objectives");
  const query = id ? table.update(values).eq("user_id", userId).eq("id", id)
    : table.insert({ ...values, user_id: userId, created_at: modifiedAt, status: "active", completed_at: null });
  const { data, error } = await query.select(columns).single();
  if (error) throw error;
  return validateRecord(data);
}

export async function changeObjectiveStatus(client: SupabaseClient, expectedUserId: string, id: string, status: "active" | "completed", now: number) {
  const userId = await getUserId(client, expectedUserId);
  const timestamp = new Date(now).toISOString();
  const { data, error } = await client.schema("public").from("objectives")
    .update({ status, completed_at: status === "completed" ? timestamp : null, updated_at: timestamp })
    .eq("user_id", userId).eq("id", id).select(columns).single();
  if (error) throw error;
  return validateRecord(data);
}

export async function deleteObjective(client: SupabaseClient, expectedUserId: string, id: string) {
  const userId = await getUserId(client, expectedUserId);
  const { data, error } = await client.schema("public").from("objectives").delete().eq("user_id", userId).eq("id", id).select("id").single();
  if (error) throw error;
  return data;
}

export type ObjectiveFilter = "all" | "active" | "reached" | "completed";
export function getDashboardObjectives(records: ObjectiveRecord[], now: number, filter: ObjectiveFilter = "all") {
  const active = records.filter((record) => record.status === "active").sort((a, b) => Date.parse(a.target_at) - Date.parse(b.target_at) || a.id.localeCompare(b.id));
  const history = records.filter((record) => record.status === "completed").sort((a, b) => Date.parse(b.completed_at!) - Date.parse(a.completed_at!) || a.id.localeCompare(b.id));
  const next = active.find((record) => Date.parse(record.target_at) > now) ?? null;
  const visibleActive = filter === "completed" ? [] : filter === "reached" ? active.filter((record) => Date.parse(record.target_at) <= now) : active;
  const featured = next && visibleActive.includes(next) ? next : null;
  return { active, history, next, featured, cards: visibleActive.filter((record) => record !== featured), visibleHistory: filter === "all" || filter === "completed" ? history : [] };
}
