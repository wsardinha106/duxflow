import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CLIENTE } from "@/config/cliente";
import { ProvedorToasts } from "@/components/Toasts";

export const metadata: Metadata = {
  title: `Conteúdos · ${CLIENTE.nome}`,
  description: `Aprovação e publicação de conteúdos do Instagram ${CLIENTE.instagram}`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <ProvedorToasts>{children}</ProvedorToasts>
      </body>
    </html>
  );
}
