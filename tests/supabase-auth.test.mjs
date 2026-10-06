import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login, persistent recovery, refresh and logout through the application client", async () => {
  const stored = new Map();
  const storage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  // A minimal browser environment; tokens are managed exclusively by the SDK.
  globalThis.localStorage = storage;
  globalThis.window = {
    location: { href: "http://localhost/", origin: "http://localhost" },
    addEventListener() {}, removeEventListener() {},
  };
  globalThis.document = { visibilityState: "visible" };
  globalThis.BroadcastChannel = undefined;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://auth-test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

  const user = { id: "test-user", aud: "authenticated", email: "test@example.com", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };
  const sessionResponse = () => ({
    access_token: [
      { alg: "HS256", typ: "JWT" },
      { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 },
    ].map((part) => Buffer.from(JSON.stringify(part)).toString("base64url")).join(".") + ".signature",
    refresh_token: "test-refresh-token", token_type: "bearer", expires_in: 3600, user,
  });
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    const url = new URL(String(input));
    requests.push(url.pathname + url.search);
    if (url.pathname.endsWith("/token")) {
      const body = JSON.parse(options.body);
      if (url.searchParams.get("grant_type") === "password" && body.password !== "correct-password") {
        return Response.json({ code: "invalid_credentials", msg: "Invalid login credentials" }, { status: 400, headers: { "x-supabase-api-version": "2024-01-01" } });
      }
      return Response.json(sessionResponse());
    }
    if (url.pathname.endsWith("/logout")) return new Response(null, { status: 204 });
    throw new Error(`Unexpected Auth request: ${url.pathname}`);
  };

  const clients = [];
  async function newBrowserSession(label) {
    const { getSupabaseClient } = await import(`../app/lib/supabase.ts?${label}`);
    const client = getSupabaseClient();
    assert.equal(getSupabaseClient(), client, "client instance is reused");
    clients.push(client);
    return client;
  }

  try {
    const first = await newBrowserSession("first");
    assert.equal((await first.auth.getSession()).data.session, null);
    const invalid = await first.auth.signInWithPassword({ email: user.email, password: "incorrect" });
    assert.equal(invalid.error.code, "invalid_credentials");
    assert.equal((await first.auth.getSession()).data.session, null);
    const signedIn = await first.auth.signInWithPassword({ email: user.email, password: "correct-password" });
    assert.equal(signedIn.error, null);
    assert.equal(signedIn.data.session.user.id, user.id);
    await first.auth.dispose();

    const requestCount = requests.length;
    const reopened = await newBrowserSession("reopened");
    assert.equal((await reopened.auth.getSession()).data.session.user.id, user.id);
    assert.equal(requests.length, requestCount, "valid persisted session needs no password login request");
    await reopened.auth.dispose();

    // Simulate time passing while the browser is closed.
    for (const [key, value] of stored) {
      const session = JSON.parse(value);
      if (session.access_token) {
        session.expires_at = Math.floor(Date.now() / 1000) - 60;
        stored.set(key, JSON.stringify(session));
      }
    }
    const refreshed = await newBrowserSession("expired");
    const events = [];
    const { data: { subscription } } = refreshed.auth.onAuthStateChange((event) => events.push(event));
    assert.equal((await refreshed.auth.getSession()).data.session.user.id, user.id);
    assert.ok(requests.some((url) => url.includes("grant_type=refresh_token")));
    assert.equal((await refreshed.auth.signOut()).error, null);
    assert.equal((await refreshed.auth.getSession()).data.session, null);
    assert.ok(events.includes("SIGNED_OUT"));
    subscription.unsubscribe();
    await refreshed.auth.dispose();

    const afterLogout = await newBrowserSession("after-logout");
    assert.equal((await afterLogout.auth.getSession()).data.session, null, "logout remains effective after reopening");
  } finally {
    for (const client of clients) await client.auth.dispose();
    globalThis.fetch = originalFetch;
  }
});

test("exported pages initially show session checking without flashing their content", async () => {
  for (const path of ["index.html", "countdown/index.html", "settings/index.html"]) {
    const html = await readFile(new URL(`../out/${path}`, import.meta.url), "utf8");
    assert.ok(html.includes('aria-label="Comprobando sesión"'), path);
    assert.ok(html.includes("loading-logo-screen"), path);
    assert.ok(html.includes("/cv-logo.png"), path);
    assert.ok(!html.includes('type="password"'), path);
    assert.ok(!html.includes('role="timer"'), path);
    assert.ok(!html.includes('type="date"'), path);
  }
});
