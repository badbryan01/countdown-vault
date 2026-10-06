import type { SupabaseClient } from "@supabase/supabase-js";

export const textFields = [
  { key: "title_text", label: "Título principal", maxLength: 60 },
  { key: "start_label", label: "Texto inicio", maxLength: 40 },
  { key: "end_label", label: "Texto objetivo", maxLength: 40 },
  { key: "message_text", label: "Mensaje inferior", maxLength: 160 },
] as const;

export type CountdownTexts = Record<(typeof textFields)[number]["key"], string>;

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

export type CountdownRecord = CountdownTexts & {
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
  const { data, error } = await client.schema("public").from("countdowns")
    .select("user_id,started_at,target_at,updated_at,title_text,start_label,end_label,message_text").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data && (!Number.isFinite(Date.parse(data.started_at)) || !Number.isFinite(Date.parse(data.target_at)) || Date.parse(data.target_at) <= Date.parse(data.started_at))) {
    throw new Error("El registro contiene fechas inválidas.");
  }
  return data;
}

export async function saveCountdown(client: SupabaseClient, expectedUserId: string, targetIso: string, pressedAt: number, texts: CountdownTexts) {
  const normalizedTexts = validateCountdownTexts(texts);
  const target = Date.parse(targetIso);
  if (!Number.isFinite(target) || target <= pressedAt || target <= Date.now()) {
    throw new Error("La fecha objetivo debe ser posterior al momento actual.");
  }
  const userId = await getUserId(client, expectedUserId);
  // Revalidate after the network request in case the selected time has passed.
  if (target <= Date.now()) throw new Error("La fecha objetivo debe ser posterior al momento actual.");
  const modifiedAt = new Date(pressedAt).toISOString();
  const { error } = await client.schema("public").from("countdowns").upsert({
    user_id: userId,
    started_at: modifiedAt,
    target_at: new Date(target).toISOString(),
    updated_at: modifiedAt,
    ...normalizedTexts,
  }, { onConflict: "user_id" });
  if (error) throw error;
}
