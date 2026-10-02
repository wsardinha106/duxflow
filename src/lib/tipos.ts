import type { TipoConteudo } from "@/config/cliente";

export type { TipoConteudo };

export type Status = "pendente" | "agendado" | "publicando" | "publicado" | "erro" | "descartado";

export const TODOS_STATUS: Status[] = ["pendente", "agendado", "publicando", "publicado", "erro", "descartado"];

export interface Conteudo {
  id: string;
  conta_instagram_id: string | null;
  tipo: TipoConteudo;
  status: Status;
  data_agendada: string;
  midia_urls: string[];
  capa_url: string | null;
  descricao: string;
  alt_text: string | null;
  hashtags: string[];
  palavra_chave: string | null;
  tema: string | null;
  origem_url: string | null;
  origem_trecho: string | null;
  nota: number | null;
  ig_container_id: string | null;
  ig_media_id: string | null;
  ig_permalink: string | null;
  erro: string | null;
  tentativas: number;
  publicando_desde: string | null;
  created_at: string;
  aprovado_em: string | null;
  publicado_em: string | null;
}
