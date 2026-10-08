import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadCountdown, saveCountdown, validateCountdownTexts, validateCountdownSettings, defaultTexts, textFields, accentThemes } from "../app/lib/countdowns.ts";
import { getCountdown, getProgressColor, getProgressPercentages, getTimeSummary, progressMilestones } from "../app/lib/countdown.ts";
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

test("objective name, theme and percentage preference are validated", () => {
  const settings = { ...defaultTexts, objective_name: "  Viaje  ", accent_theme: "green", show_progress_percentage: true };
  assert.equal(validateCountdownSettings(settings).objective_name, "Viaje");
  for (const name of ["", "  ", "x".repeat(61)]) assert.throws(() => validateCountdownSettings({ ...settings, objective_name: name }));
  assert.equal(validateCountdownSettings({ ...settings, objective_name: "x".repeat(60) }).objective_name.length, 60);
  for (const theme of accentThemes) {
    assert.equal(validateCountdownSettings({ ...settings, accent_theme: theme.value }).accent_theme, theme.value);
  }
  assert.throws(() => validateCountdownSettings({ ...settings, accent_theme: "red" }));
  assert.equal(validateCountdownSettings({ ...settings, show_progress_percentage: false }).show_progress_percentage, false);
  assert.throws(() => validateCountdownSettings({ ...settings, show_progress_percentage: "false" }));
});

test("percentages complement each other and milestones activate at their exact thresholds", () => {
  const reached = { 0: [], 25: [25], 50: [25, 50], 75: [25, 50, 75], 90: [25, 50, 75, 90], 100: [25, 50, 75, 90] };
  for (const percentage of [0, 25, 50, 75, 90, 100]) {
    const progress = getCountdown(percentage * 1000, 0, 100000).progress;
    assert.deepEqual(getProgressPercentages(progress), { elapsed: `${percentage},0`, remaining: `${100 - percentage},0` });
    assert.deepEqual(progressMilestones.filter((milestone) => progress >= milestone), reached[percentage]);
    if (percentage > 0 && percentage < 100) {
      const before = getCountdown(percentage * 1000 - 1, 0, 100000).progress;
      assert.ok(!progressMilestones.filter((milestone) => before >= milestone).includes(percentage));
    }
  }
  assert.deepEqual(getProgressPercentages(23.7), { elapsed: "23,7", remaining: "76,3" });
  assert.deepEqual(getProgressPercentages(23.75), { elapsed: "23,8", remaining: "76,2" });
  assert.deepEqual(getProgressPercentages(-10), { elapsed: "0,0", remaining: "100,0" });
  assert.deepEqual(getProgressPercentages(110), { elapsed: "100,0", remaining: "0,0" });
});

test("time summaries use natural Spanish days, hours and minutes, including completion", () => {
  const day = 86400000;
  assert.deepEqual(getTimeSummary(14 * day, 0, 60 * day), { elapsed: "Han transcurrido 14 días desde que comenzó.", remaining: "Quedan 46 días para tu objetivo." });
  assert.equal(getTimeSummary(day, 0, 2 * day).elapsed, "Ha transcurrido 1 día desde que comenzó.");
  assert.equal(getTimeSummary(3600000, 0, 7200000).remaining, "Queda 1 hora para tu objetivo.");
  assert.equal(getTimeSummary(60000, 0, 120000).elapsed, "Ha transcurrido 1 minuto desde que comenzó.");
  assert.equal(getTimeSummary(0, 0, 59000).remaining, "Queda menos de un minuto para tu objetivo.");
  assert.equal(getTimeSummary(100, 200, 300).elapsed, "La cuenta regresiva aún no ha comenzado.");
  assert.equal(getTimeSummary(day, 0, day).remaining, "Ya llegaste a tu fecha objetivo.");
  assert.equal(getTimeSummary(2 * day, 0, day).remaining, "Ya llegaste a tu fecha objetivo.");
});

test("SDK persists customization, preserves start for personalization and resets it only for a new target", async () => {
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
      for (const field of ["objective_name", "accent_theme", "show_progress_percentage"]) assert.ok(url.searchParams.get("select").split(",").includes(field));
      if (failQuery) return Response.json({ message: "Database unavailable" }, { status: 503 });
      return Response.json(rows.has(user.id) ? [rows.get(user.id)] : []);
    } },
  });
  try {
    await client.auth.signInWithPassword({ email: user.email, password: "test" });
    assert.equal(await loadCountdown(client, user.id), null);
    const firstPress = Date.now();
    const target = new Date(firstPress + 86400000).toISOString();
    const texts = { title_text: "Mi viaje", start_label: "Hoy", end_label: "El destino", message_text: "  Ya queda menos.  ", objective_name: "Viaje", accent_theme: "green", show_progress_percentage: true };
    await saveCountdown(client, user.id, target, firstPress, texts);
    assert.deepEqual(await loadCountdown(client, user.id), {
      user_id: user.id, started_at: new Date(firstPress).toISOString(), target_at: target, updated_at: new Date(firstPress).toISOString(),
      ...texts, message_text: "Ya queda menos.",
    });
    const secondPress = firstPress + 1000;
    await saveCountdown(client, user.id, target.replace("Z", "+00:00"), secondPress, { ...texts, title_text: "Mi nuevo viaje", objective_name: "Vacaciones", accent_theme: "blue", show_progress_percentage: false });
    assert.equal(rows.size, 1);
    assert.equal(rows.get(user.id).started_at, new Date(firstPress).toISOString());
    assert.equal(rows.get(user.id).updated_at, new Date(secondPress).toISOString());
    const saved = await loadCountdown(client, user.id);
    assert.equal(saved.title_text, "Mi nuevo viaje");
    assert.equal(saved.objective_name, "Vacaciones");
    assert.equal(saved.accent_theme, "blue");
    assert.equal(saved.show_progress_percentage, false);
    for (const [index, theme] of accentThemes.entries()) {
      const editPress = secondPress + index + 1;
      await saveCountdown(client, user.id, target, editPress, { ...texts, accent_theme: theme.value });
      const edited = await loadCountdown(client, user.id);
      assert.equal(edited.accent_theme, theme.value);
      assert.equal(edited.started_at, new Date(firstPress).toISOString(), "theme-only edits preserve the start");
      assert.equal(edited.updated_at, new Date(editPress).toISOString());
    }
    const thirdPress = secondPress + 1000;
    await saveCountdown(client, user.id, new Date(firstPress + 2 * 86400000).toISOString(), thirdPress, texts);
    assert.equal(rows.get(user.id).started_at, new Date(thirdPress).toISOString());
    assert.equal(rows.get(user.id).updated_at, new Date(thirdPress).toISOString());
    await assert.rejects(() => saveCountdown(client, user.id, new Date(firstPress).toISOString(), firstPress, texts));
    await assert.rejects(() => saveCountdown(client, user.id, "invalid", firstPress, texts));
    await assert.rejects(() => saveCountdown(client, "other-user", target, firstPress, texts));
    await assert.rejects(() => saveCountdown(client, user.id, target, firstPress, { ...texts, start_label: " " }));
    assert.equal(writes, 7);
    failQuery = true;
    await assert.rejects(() => loadCountdown(client, user.id));
    failQuery = false;
    failWrite = true;
    await assert.rejects(() => saveCountdown(client, user.id, target, firstPress, texts));
    failWrite = false;
    const completed = { ...rows.get(user.id), started_at: new Date(firstPress - 120000).toISOString(), target_at: new Date(firstPress - 60000).toISOString() };
    rows.set(user.id, completed);
    await saveCountdown(client, user.id, completed.target_at, Date.now(), { ...texts, accent_theme: "violet", show_progress_percentage: false });
    assert.equal(rows.get(user.id).started_at, completed.started_at, "an expired target can still be personalized without restarting");
    rows.set(user.id, { ...rows.get(user.id), target_at: "invalid" });
    await assert.rejects(() => loadCountdown(client, user.id));
  } finally {
    await client.auth.dispose();
  }
});
