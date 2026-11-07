import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Asistente comercial · Mindlin Developers",
  description: "El agente de IA que atiende las consultas comerciales por WhatsApp.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
