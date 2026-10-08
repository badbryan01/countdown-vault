import type { ReactNode } from "react";
import Image from "next/image";
import type { AccentTheme } from "../lib/countdowns";
import { Space_Grotesk } from "next/font/google";

const brandFont = Space_Grotesk({ subsets: ["latin"], weight: "600", display: "swap" });

export function AppShell({ children, action, accentTheme = "green" }: { children: ReactNode; action?: ReactNode; accentTheme?: AccentTheme }) {
  return (
    <div className="app-shell" data-accent={accentTheme}>
      <header className="app-header">
        <span className="brand">
          <Image className="brand-mark" src={`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/cv-logo.png`} alt="" aria-hidden="true" width={30} height={30} unoptimized />
          <span className={brandFont.className}>Countdown Vault</span>
        </span>
        {action}
      </header>
      <main className="main-content">{children}</main>
      <footer className="app-footer">Un momento en el futuro. Un segundo a la vez.</footer>
    </div>
  );
}
