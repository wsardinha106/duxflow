"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { traduzirErroAuth } from "@/lib/supabase/erros";

export function FormLogin({ erroInicial, senhaAlterada }: { erroInicial: string | null; senhaAlterada: boolean }) {
  const router = useRouter();
  const [modo, setModo] = useState<"entrar" | "esqueci">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(erroInicial);
  const [aviso, setAviso] = useState<string | null>(senhaAlterada ? "Senha alterada. Entre com a nova senha." : null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    setOcupado(true);
    const supabase = criarClienteNavegador();
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) return setErro(traduzirErroAuth(error.message));
        router.replace("/");
        router.refresh();
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/auth/callback?proximo=/auth/redefinir`,
        });
        if (error) return setErro(traduzirErroAuth(error.message));
        setAviso("Se este e-mail tiver acesso, você vai receber um link para criar uma nova senha.");
      }
    } catch (e) {
      setErro(traduzirErroAuth(e instanceof Error ? e.message : String(e)));
    } finally {
      setOcupado(false);
    }
  }

  const campo = "w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base outline-none focus:border-zinc-900";
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">E-mail</span>
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
      </label>
      {modo === "entrar" && (
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Senha</span>
          <input type="password" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} className={campo} />
        </label>
      )}
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
      {aviso && <p className="rounded-lg bg-emerald-50 p-2 text-sm text-emerald-800">{aviso}</p>}
      <button type="submit" disabled={ocupado} className="mt-1 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {ocupado ? "Aguarde…" : modo === "entrar" ? "Entrar" : "Enviar link de redefinição"}
      </button>
      <button
        type="button"
        onClick={() => {
          setModo(modo === "entrar" ? "esqueci" : "entrar");
          setErro(null);
          setAviso(null);
        }}
        className="text-sm text-zinc-500 underline-offset-2 hover:underline"
      >
        {modo === "entrar" ? "Esqueci a senha" : "Voltar para o login"}
      </button>
    </form>
  );
}
