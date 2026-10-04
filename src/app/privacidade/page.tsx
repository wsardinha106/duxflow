import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CLIENTE } from "@/config/cliente";

export const metadata: Metadata = { title: "Política de Privacidade" };

/** Página pública exigida pela Meta (Configurações do app → Básico → URL da Política de Privacidade). */
export default function PaginaPrivacidade() {
  const contato = CLIENTE.emailContato ? (
    <a href={`mailto:${CLIENTE.emailContato}`} className="text-violet-700 underline">
      {CLIENTE.emailContato}
    </a>
  ) : (
    "o e-mail de contato informado no app da Meta"
  );

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 md:py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-zinc-500">{CLIENTE.marca} · atualizada em outubro de 2026</p>

      <div className="mt-8 flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-6 text-[15px] leading-relaxed text-zinc-700 shadow-sm md:p-8">
        <p>
          O {CLIENTE.marca} é um painel de uso interno, com acesso restrito por login, usado para aprovar e agendar publicações em uma única conta
          profissional do Instagram. Não há cadastro público e o serviço não é oferecido a terceiros.
        </p>

        <Secao titulo="Quais dados usamos">
          <ul className="list-disc space-y-1 pl-5">
            <li>E-mail e senha dos usuários autorizados a entrar no painel (guardados pelo provedor de autenticação, Supabase).</li>
            <li>
              Da conta do Instagram conectada: nome de usuário, nome, foto de perfil, número de seguidores e de publicações, e o token de acesso
              concedido pela própria conta.
            </li>
            <li>Os conteúdos a publicar (vídeos, imagens, legendas e hashtags) e o resultado de cada publicação.</li>
          </ul>
        </Secao>

        <Secao titulo="Para que usamos">
          <p>
            Exclusivamente para mostrar a fila e o calendário de conteúdos e publicar, no horário agendado, os conteúdos aprovados na conta do
            Instagram conectada. Não usamos os dados para publicidade, não traçamos perfis e não acessamos mensagens nem dados de seguidores.
          </p>
        </Secao>

        <Secao titulo="Compartilhamento">
          <p>
            Não vendemos nem compartilhamos dados com terceiros. Os dados ficam nos provedores que fazem o serviço funcionar: Supabase (banco de
            dados e arquivos), Vercel (hospedagem) e Meta (API do Instagram, para publicar).
          </p>
        </Secao>

        <Secao titulo="Segurança e retenção">
          <p>
            O token do Instagram fica guardado só no servidor, nunca é exibido no navegador e é renovado automaticamente. Os dados são mantidos
            enquanto a conta estiver conectada ao painel.
          </p>
        </Secao>

        <Secao titulo="Exclusão de dados" id="exclusao">
          <p>
            Para remover o acesso, desconecte a conta na tela <b>Conexões</b> do painel ou remova o app em Instagram → Configurações → Apps e sites.
            Para pedir a exclusão de todos os dados, escreva para {contato}; a exclusão é feita em até 30 dias.
          </p>
        </Secao>

        <Secao titulo="Contato">
          <p>Dúvidas sobre esta política: {contato}.</p>
        </Secao>
      </div>
    </main>
  );
}

function Secao({ titulo, id, children }: { titulo: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-2">
      <h2 className="text-lg font-bold text-zinc-900">{titulo}</h2>
      {children}
    </section>
  );
}
