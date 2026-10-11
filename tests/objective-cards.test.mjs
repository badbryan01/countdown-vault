import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const cache = new Map();
// Exercise the actual TSX without adding a bundler or a browser-test dependency.
// Only the Next router link adapter is replaced for this DOM-free render.
function loadComponent(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const compiledModule = { exports: {} };
  cache.set(path, compiledModule);
  const javascript = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const localRequire = (specifier) => {
    if (specifier.endsWith("/loading-link")) return { LoadingLink: ({ children, href, ...props }) => React.createElement("a", { ...props, href }, children) };
    if (!specifier.startsWith(".")) return require(specifier);
    const base = resolve(dirname(path), specifier);
    return loadComponent(base + (specifier.endsWith("/objective-status-action") || specifier.endsWith("/loading-logo") ? ".tsx" : ".ts"));
  };
  runInThisContext(`(function(require,module,exports){${javascript}\n})`, { filename: path })(localRequire, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const { ObjectiveCard } = loadComponent(resolve("app/components/objective-card.tsx"));
const base = { id: "one", user_id: "user", objective_name: "Viaje", title_text: "Mi próximo viaje", start_label: "Hoy", end_label: "El destino", message_text: "Cada vez más cerca.", started_at: "2026-10-01T12:00:00Z", target_at: "2026-10-11T12:00:00Z", created_at: "2026-10-01T12:00:00Z", updated_at: "2026-10-01T12:00:00Z", status: "active", completed_at: null, accent_theme: "green", show_progress_percentage: true };
const render = (record, now, props = {}) => renderToStaticMarkup(React.createElement(ObjectiveCard, { record, now, onChanged() {}, ...props }));

test("full objective card retains personalized content, Santiago date, milestones and static query links", () => {
  const html = render(base, Date.parse("2026-10-06T12:00:00Z"), { detail: true });
  for (const text of ["Mi próximo viaje", "Hoy", "El destino", "Cada vez más cerca.", "11 de octubre de 2026", "09:00", "25 %", "50 %", "75 %", "90 %", "50,0 % transcurrido"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes('href="/settings?id=one"'));
  assert.ok(html.includes('role="timer"'));
  assert.ok(html.includes('aria-valuenow="50"'));
});

test("cards coexist with independent themes and optional percentages; expired cards remain actionable", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  for (const theme of ["green", "blue", "violet", "amber"]) {
    const html = render({ ...base, id: theme, accent_theme: theme, show_progress_percentage: false }, now);
    assert.ok(html.includes(`data-accent="${theme}"`));
    assert.ok(html.includes("Fecha alcanzada"));
    assert.ok(html.includes("Marcar como logrado"));
    assert.ok(html.includes('aria-valuenow="100"'));
    assert.ok(html.includes("hsl(0 76% 60%)"));
    assert.ok(!html.includes("% transcurrido"));
    assert.equal((html.match(/countdown-number">00</g) ?? []).length, 4);
  }
  const compact = render(base, now, { compact: true });
  assert.ok(compact.includes("00 días · 00 horas · 00 minutos"));
  assert.ok(compact.includes('href="/countdown?id=one"'));
  const completed = render({ ...base, status: "completed", completed_at: base.target_at }, now);
  assert.ok(completed.includes("Objetivo logrado ✓"));
  assert.ok(completed.includes("Reabrir"));
  assert.ok(!completed.includes("Marcar como logrado"));
});
