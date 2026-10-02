import type { Metadata } from "next";
import { Conexoes } from "@/components/Conexoes";

export const metadata: Metadata = { title: "Conexões" };

export default function PaginaConexoes() {
  return <Conexoes />;
}
