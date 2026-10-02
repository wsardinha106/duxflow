import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect("/login");
  return <Shell email={usuario.email ?? ""}>{children}</Shell>;
}
