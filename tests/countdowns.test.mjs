import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadCountdown, saveCountdown, validateCountdownTexts, defaultTexts, textFields } from "../app/lib/countdowns.ts";
import { getCountdown, getProgressColor } from "../app/lib/countdown.ts";
import { santiagoToIso, getSantiagoFields, formatCurrentDateTime } from "../app/lib/santiago-time.ts";

test("Santiago timestamps round-trip in summer and winter independently of the browser zone", () => {
  assert.equal(santiagoToIso("2027-01-01", "00:00"), "2027-01-01T03:00:00.000Z");
  assert.equal(santiagoToIso("2027-07-01", "12:30"), "2027-07-01T16:30:00.000Z");
  for (const [date, time] of [["2027-01-01", "00:00"], ["2027-07-01", "12:30"]]) {
    const fields = getSantiagoFields(santiagoToIso(date, time));
    assert.equal(fields.date, date);
    assert.equal(fields.time, time);
  }
  assert.throws(() => santiagoToIso("2027-02-30", "12:00"));
  assert.throws(() => santiagoToIso("", ""));
  assert.throws(() => santiagoToIso("2027-01-01", "24:00"));
  assert.throws(() => santiagoToIso("2026-09-06", "00:30"), /cambio de horario/);
  // Autumn's repeated hour uses its first occurrence (UTC-03:00).
  assert.equal(santiagoToIso("2026-04-04", "23:30"), "2026-04-05T02:30:00.000Z");
});

test("countdown clamps progress and finishes at zero with a full red bar", () => {
  assert.equal(getCountdown(-1, 0, 100000).progress, 0);
  assert.equal(getCountdown(50000, 0, 100000).progress, 50);
  for (const now of [100000, 200000]) {
    const state = getCountdown(now, 0, 100000);
    assert.deepEqual([state.days, state.hours, state.minutes, state.seconds], [0, 0, 0, 0]);
    assert.equal(state.progress, 100);
    assert.equal(state.complete, true);
    assert.equal(getProgressColor(state.progress), "hsl(0 76% 60%)");
  }
  assert.equal(getCountdown(0, 0, 0).progress, 100);
  const state = getCountdown(0, -1, 90061000);
  assert.deepEqual([state.days, state.hours, state.minutes, state.seconds], [1, 1, 1, 1]);
  for (const [progress, hue] of [[0,145], [50,48], [75,25], [95,0]]) {
    assert.equal(getProgressColor(progress), `hsl(${hue} 76% 60%)`);
  }
});

test("current clock shows Santiago seconds, 24-hour midnight rollover and seasonal offsets", () => {
  const format = (iso) => formatCurrentDateTime(Date.parse(iso));
  assert.equal(format("2026-10-06T02:14:08Z"), "5 de octubre de 2026, 23:14:08");
  assert.equal(format("2026-10-06T02:14:09Z"), "5 de octubre de 2026, 23:14:09");
  assert.equal(format("2026-10-06T02:59:59Z"), "5 de octubre de 2026, 23:59:59");
  assert.equal(format("2026-10-06T03:00:00Z"), "6 de octubre de 2026, 00:00:00");
  assert.equal(format("2027-07-01T16:30:45Z"), "1 de julio de 2027, 12:30:45");
  assert.equal(format("2027-01-01T03:00:00Z"), "1 de enero de 2027, 00:00:00");
});

test("personalized texts trim spaces and reject empty or oversized fields", () => {
  const padded = Object.fromEntries(Object.entries(defaultTexts).map(([key, value]) => [key, `  ${value}  `]));
  assert.deepEqual(validateCountdownTexts(padded), defaultTexts);
  for (const field of textFields) {
    for (const value of ["", "   ", "x".repeat(field.maxLength + 1)]) {
      assert.throws(() => validateCountdownTexts({ ...defaultTexts, [field.key]: value }), new RegExp(field.label));
    }
    const maxValue = "x".repeat(field.maxLength);
    assert.equal(validateCountdownTexts({ ...defaultTexts, [field.key]: maxValue })[field.key], maxValue);
  }
  // User content remains literal text; the UI renders it through React's escaping.
  assert.equal(validateCountdownTexts({ ...defaultTexts, title_text: "<b>Mi momento</b>" }).title_text, "<b>Mi momento</b>");
});

test("SDK queries and upserts only the verified user's row, resets its start and propagates errors", async () => {
  const user = { id: "test-user", aud: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const rows = new Map();
  let failQuery = false;
  let failWrite = false;
  let writes = 0;
  const token = [{ alg: "HS256" }, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".signature";
  const client = createClient("https://countdowns-test.supabase.co", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/token")) return Response.json({ access_token: token, refresh_token: "refresh", token_type: "bearer", expires_in: 3600, user });
      if (url.pathname.endsWith("/user")) return Response.json(user);
      assert.equal(url.pathname, "/rest/v1/countdowns");
      const headers = new Headers(options.headers);
      if (options.method === "POST") {
        if (failWrite) return Response.json({ message: "RLS rejected write" }, { status: 403 });
        assert.equal(url.searchParams.get("on_conflict"), "user_id");
        assert.ok(headers.get("prefer").includes("resolution=merge-duplicates"));
        assert.equal(headers.get("content-profile"), "public");
        const row = JSON.parse(options.body);
        rows.set(row.user_id, row);
        writes++;
        return new Response(null, { status: 201 });
      }
      assert.equal(headers.get("accept-profile"), "public");
      assert.equal(url.searchParams.get("user_id"), `eq.${user.id}`);
      for (const field of textFields) assert.ok(url.searchParams.get("select").split(",").includes(field.key));
      if (failQuery) return Response.json({ message: "Database unavailable" }, { status: 503 });
      return Response.json(rows.has(user.id) ? [rows.get(user.id)] : []);
    } },
  });
  try {
    await client.auth.signInWithPassword({ email: user.email, password: "test" });
    assert.equal(await loadCountdown(client, user.id), null);
    const firstPress = Date.now();
    const target = new Date(firstPress + 86400000).toISOString();
    const texts = { title_text: "Mi viaje", start_label: "Hoy", end_label: "El destino", message_text: "  Ya queda menos.  " };
    await saveCountdown(client, user.id, target, firstPress, texts);
    assert.deepEqual(await loadCountdown(client, user.id), {
      user_id: user.id, started_at: new Date(firstPress).toISOString(), target_at: target, updated_at: new Date(firstPress).toISOString(),
      ...texts, message_text: "Ya queda menos.",
    });
    const secondPress = firstPress + 1000;
    await saveCountdown(client, user.id, target, secondPress, { ...texts, title_text: "Mi nuevo viaje" });
    assert.equal(rows.size, 1);
    assert.equal(rows.get(user.id).started_at, new Date(secondPress).toISOString());
    assert.equal(rows.get(user.id).updated_at, rows.get(user.id).started_at);
    assert.equal((await loadCountdown(client, user.id)).title_text, "Mi nuevo viaje");
    await assert.rejects(() => saveCountdown(client, user.id, new Date(firstPress).toISOString(), firstPress, texts));
    await assert.rejects(() => saveCountdown(client, user.id, "invalid", firstPress, texts));
    await assert.rejects(() => saveCountdown(client, "other-user", target, firstPress, texts));
    await assert.rejects(() => saveCountdown(client, user.id, target, firstPress, { ...texts, start_label: " " }));
    assert.equal(writes, 2);
    failQuery = true;
    await assert.rejects(() => loadCountdown(client, user.id));
    failQuery = false;
    failWrite = true;
    await assert.rejects(() => saveCountdown(client, user.id, target, firstPress, texts));
    rows.set(user.id, { ...rows.get(user.id), target_at: "invalid" });
    await assert.rejects(() => loadCountdown(client, user.id));
  } finally {
    await client.auth.dispose();
  }
});
