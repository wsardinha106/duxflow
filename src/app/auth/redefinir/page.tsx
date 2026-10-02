"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/supabase/erros";

export default function PaginaRedefinir() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha !== confirmacao) return setErro("As senhas não são iguais.");
    setOcupado(true);
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setOcupado(false);
    if (error) return setErro(traduzirErroAuth(error.message));
    await supabase.auth.signOut();
    router.replace("/login?senha=ok");
  }

  const campo = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <form onSubmit={salvar} className="flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold">Criar nova senha</h1>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Nova senha</span>
          <input type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Repita a nova senha</span>
          <input type="password" autoComplete="new-password" value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} className={campo} required />
        </label>
        {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
        <button type="submit" disabled={ocupado} className="rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {ocupado ? "Salvando…" : "Salvar senha"}
        </button>
      </form>
    </main>
  );
}
