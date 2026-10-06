import type { Metadata } from "next";
import { AuthProvider } from "./components/auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Countdown Vault",
  description: "Personal countdown application",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es">
      <body><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
