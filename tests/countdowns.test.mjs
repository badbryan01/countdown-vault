import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { loadObjective, loadObjectives, saveObjective, changeObjectiveStatus, deleteObjective, getDashboardObjectives, validateObjectiveTexts, validateObjectiveSettings, defaultTexts, textFields, accentThemes } from "../app/lib/objectives.ts";
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
  assert.deepEqual(validateObjectiveTexts(padded), defaultTexts);
  for (const field of textFields) {
    for (const value of ["", "   ", "x".repeat(field.maxLength + 1)]) {
      assert.throws(() => validateObjectiveTexts({ ...defaultTexts, [field.key]: value }), new RegExp(field.label));
    }
    const maxValue = "x".repeat(field.maxLength);
    assert.equal(validateObjectiveTexts({ ...defaultTexts, [field.key]: maxValue })[field.key], maxValue);
  }
  // User content remains literal text; the UI renders it through React's escaping.
  assert.equal(validateObjectiveTexts({ ...defaultTexts, title_text: "<b>Mi momento</b>" }).title_text, "<b>Mi momento</b>");
});

test("objective name, theme and percentage preference are validated", () => {
  const settings = { ...defaultTexts, objective_name: "  Viaje  ", accent_theme: "green", show_progress_percentage: true };
  assert.equal(validateObjectiveSettings(settings).objective_name, "Viaje");
  for (const name of ["", "  ", "x".repeat(61)]) assert.throws(() => validateObjectiveSettings({ ...settings, objective_name: name }));
  assert.equal(validateObjectiveSettings({ ...settings, objective_name: "x".repeat(60) }).objective_name.length, 60);
  for (const theme of accentThemes) {
    assert.equal(validateObjectiveSettings({ ...settings, accent_theme: theme.value }).accent_theme, theme.value);
  }
  assert.throws(() => validateObjectiveSettings({ ...settings, accent_theme: "red" }));
  assert.equal(validateObjectiveSettings({ ...settings, show_progress_percentage: false }).show_progress_percentage, false);
  assert.throws(() => validateObjectiveSettings({ ...settings, show_progress_percentage: "false" }));
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

const settings = { ...defaultTexts, objective_name: "Viaje", accent_theme: "green", show_progress_percentage: true };
function record(id, target, overrides = {}) {
  return { ...settings, id, user_id: "test-user", started_at: "2026-01-01T00:00:00Z", target_at: target, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z", status: "active", completed_at: null, ...overrides };
}

test("dashboard handles zero, one and many objectives, nearest future highlight, filters and independent themes", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const empty = getDashboardObjectives([], now);
  assert.equal(empty.next, null);
  assert.deepEqual(empty.cards, []);
  assert.deepEqual(empty.history, []);
  const near = record("near", "2026-10-12T12:00:00Z", { accent_theme: "violet" });
  const far = record("far", "2026-11-12T12:00:00Z", { accent_theme: "blue" });
  const reached = record("reached", "2026-10-11T12:00:00Z", { accent_theme: "amber" });
  const done = record("done", "2026-10-01T00:00:00Z", { status: "completed", completed_at: "2026-10-02T00:00:00Z" });
  const recent = record("recent", "2026-09-01T00:00:00Z", { status: "completed", completed_at: "2026-10-10T00:00:00Z" });
  assert.equal(getDashboardObjectives([near], now).featured.id, "near");
  assert.deepEqual(getDashboardObjectives([near], now).cards, []);
  const input = [far, done, near, recent, reached];
  const dashboard = getDashboardObjectives(input, now);
  assert.deepEqual(dashboard.active.map((item) => item.id), ["reached", "near", "far"]);
  assert.equal(dashboard.featured.id, "near");
  assert.deepEqual(dashboard.cards.map((item) => item.id), ["reached", "far"]);
  assert.deepEqual(dashboard.history.map((item) => item.id), ["recent", "done"]);
  assert.deepEqual(dashboard.active.map((item) => item.accent_theme), ["amber", "violet", "blue"]);
  assert.equal(dashboard.history[0].accent_theme, "green");
  assert.equal(getDashboardObjectives(input, now, "reached").featured, null);
  assert.deepEqual(getDashboardObjectives(input, now, "reached").cards.map((item) => item.id), ["reached"]);
  assert.deepEqual(getDashboardObjectives(input, now, "active").visibleHistory, []);
  assert.deepEqual(getDashboardObjectives(input, now, "completed").cards, []);
  assert.deepEqual(getDashboardObjectives(input, now, "completed").visibleHistory.map((item) => item.id), ["recent", "done"]);
  assert.equal(getDashboardObjectives([reached], now).next, null);
  assert.equal(getCountdown(now, Date.parse(reached.started_at), Date.parse(reached.target_at)).complete, true);
  assert.equal(reached.status, "active", "reaching the date does not complete the objective");
  assert.deepEqual(input.map((item) => item.id), ["far", "done", "near", "recent", "reached"], "sorting does not mutate input");
});

test("SDK creates, edits, completes, reopens and deletes individual objectives with user isolation", async () => {
  const user = { id: "test-user", aud: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const rows = new Map();
  let failQuery = false;
  let failWrite = false;
  let writes = 0;
  let reads = 0;
  const token = [{ alg: "HS256" }, { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".signature";
  const client = createClient("https://objectives-test.supabase.co", "sb_publishable_test", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/token")) return Response.json({ access_token: token, refresh_token: "refresh", token_type: "bearer", expires_in: 3600, user });
      if (url.pathname.endsWith("/user")) return Response.json(user);
      assert.equal(url.pathname, "/rest/v1/objectives", "only the new table is used");
      const headers = new Headers(options.headers);
      const method = options.method;
      if (method === "POST") {
        if (failWrite) return Response.json({ message: "RLS rejected write" }, { status: 403 });
        const body = JSON.parse(options.body);
        assert.ok(!Object.hasOwn(body, "id"), "the database generates the UUID");
        assert.equal(body.user_id, user.id);
        assert.equal(headers.get("content-profile"), "public");
        const row = { ...body, id: `generated-${rows.size + 1}` };
        rows.set(row.id, row);
        writes++;
        return Response.json(row, { status: 201 });
      }
      assert.equal(url.searchParams.get("user_id"), `eq.${user.id}`, "reads and mutations are scoped to the authenticated user");
      const id = url.searchParams.get("id")?.slice(3);
      const matching = [...rows.values()].filter((row) => row.user_id === user.id && (!id || row.id === id));
      if (method === "PATCH" || method === "DELETE") {
        if (failWrite) return Response.json({ message: "Write rejected" }, { status: 403 });
        assert.ok(id, "never mutate all user objectives");
        assert.equal(headers.get("content-profile"), "public");
        if (!matching.length) return Response.json({ message: "No row" }, { status: 406 });
        const row = method === "PATCH" ? { ...matching[0], ...JSON.parse(options.body) } : matching[0];
        if (method === "PATCH") rows.set(id, row); else rows.delete(id);
        writes++;
        return Response.json(row);
      }
      reads++;
      assert.equal(headers.get("accept-profile"), "public");
      if (failQuery) return Response.json({ message: "Database unavailable" }, { status: 400 });
      for (const field of [...textFields.map((field) => field.key), "id", "status", "completed_at", "objective_name", "accent_theme", "show_progress_percentage"]) assert.ok(url.searchParams.get("select").split(",").includes(field));
      return Response.json(matching);
    } },
  });
  try {
    await client.auth.signInWithPassword({ email: user.email, password: "test" });
    assert.deepEqual(await loadObjectives(client, user.id), []);
    assert.equal(await loadObjective(client, user.id, "missing"), null);
    const press = Date.now();
    const target = new Date(press + 86400000).toISOString();
    const first = await saveObjective(client, user.id, null, target, press, { ...settings, message_text: "  Ya queda menos.  " });
    assert.equal(first.started_at, new Date(press).toISOString());
    assert.equal(first.created_at, first.started_at);
    assert.equal(first.updated_at, first.started_at);
    assert.equal(first.status, "active");
    assert.equal(first.completed_at, null);
    assert.equal(first.message_text, "Ya queda menos.");
    for (const [index, theme] of accentThemes.entries()) {
      await saveObjective(client, user.id, first.id, target.replace("Z", "+00:00"), press + index + 1, { ...settings, accent_theme: theme.value, show_progress_percentage: false });
      const edited = await loadObjective(client, user.id, first.id);
      assert.equal(edited.started_at, first.started_at);
      assert.equal(edited.created_at, first.created_at);
      assert.equal(edited.updated_at, new Date(press + index + 1).toISOString());
      assert.equal(edited.accent_theme, theme.value);
      assert.equal(edited.show_progress_percentage, false);
    }
    const second = await saveObjective(client, user.id, null, new Date(press + 2 * 86400000).toISOString(), press + 100, { ...settings, accent_theme: "violet" });
    const readCount = reads;
    assert.equal((await loadObjectives(client, user.id)).length, 2);
    assert.equal(reads, readCount + 1, "dashboard uses one main table query");
    const changed = await saveObjective(client, user.id, first.id, new Date(press + 3 * 86400000).toISOString(), press + 1000, settings);
    assert.equal(changed.started_at, new Date(press + 1000).toISOString());
    assert.equal(rows.get(second.id).started_at, second.started_at, "editing one objective leaves the other unchanged");
    const completed = await changeObjectiveStatus(client, user.id, first.id, "completed", press + 2000);
    assert.equal(completed.completed_at, new Date(press + 2000).toISOString());
    assert.equal(completed.updated_at, completed.completed_at);
    assert.equal(completed.started_at, changed.started_at);
    const view = getDashboardObjectives(await loadObjectives(client, user.id), press + 2000);
    assert.equal(view.active.length, 1);
    assert.equal(view.history[0].id, first.id);
    const reopened = await changeObjectiveStatus(client, user.id, first.id, "active", press + 3000);
    assert.equal(reopened.completed_at, null);
    assert.equal(reopened.started_at, changed.started_at);
    assert.equal(reopened.updated_at, new Date(press + 3000).toISOString());
    rows.set("other", { ...second, id: "other", user_id: "other-user" });
    assert.equal(await loadObjective(client, user.id, "other"), null);
    assert.equal((await loadObjectives(client, user.id)).length, 2);
    await assert.rejects(() => saveObjective(client, user.id, "other", target, press, settings));
    await assert.rejects(() => changeObjectiveStatus(client, user.id, "other", "completed", press));
    await assert.rejects(() => deleteObjective(client, user.id, "other"));
    await assert.rejects(() => loadObjectives(client, "other-user"));
    const previousWrites = writes;
    await assert.rejects(() => saveObjective(client, user.id, null, new Date(press - 1).toISOString(), press, settings));
    await assert.rejects(() => saveObjective(client, user.id, null, "invalid", press, settings));
    await assert.rejects(() => saveObjective(client, user.id, first.id, target, press, { ...settings, start_label: " " }));
    assert.equal(writes, previousWrites);
    const expired = { ...rows.get(first.id), started_at: new Date(press - 120000).toISOString(), target_at: new Date(press - 60000).toISOString() };
    rows.set(first.id, expired);
    const personalized = await saveObjective(client, user.id, first.id, expired.target_at, press + 4000, { ...settings, accent_theme: "blue" });
    assert.equal(personalized.started_at, expired.started_at);
    assert.equal(personalized.status, "active");
    failQuery = true;
    await assert.rejects(() => loadObjectives(client, user.id));
    failQuery = false;
    failWrite = true;
    await assert.rejects(() => saveObjective(client, user.id, first.id, expired.target_at, press, settings));
    await assert.rejects(() => changeObjectiveStatus(client, user.id, first.id, "completed", press));
    await assert.rejects(() => deleteObjective(client, user.id, first.id));
    failWrite = false;
    await deleteObjective(client, user.id, first.id);
    assert.equal(await loadObjective(client, user.id, first.id), null);
    assert.equal(rows.get("other").user_id, "other-user");
    assert.equal(rows.get(second.id).id, second.id);
    rows.set(second.id, { ...second, target_at: "invalid" });
    await assert.rejects(() => loadObjectives(client, user.id));
  } finally { await client.auth.dispose(); }
});
