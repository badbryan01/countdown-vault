import type { ReactNode } from "react";

export function AppShell({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand"><span className="brand-mark" aria-hidden="true">◷</span> Countdown Vault</span>
        {action}
      </header>
      <main className="main-content">{children}</main>
      <footer className="app-footer">Un momento en el futuro. Un segundo a la vez.</footer>
    </div>
  );
}
