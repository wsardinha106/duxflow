/** Mensagens do Supabase Auth em português. */
export function traduzirErroAuth(mensagem: string | undefined | null): string {
  const m = (mensagem ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Este e-mail ainda não foi confirmado.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Espere alguns minutos e tente de novo.";
  if (m.includes("password should be") || m.includes("at least")) return "A senha precisa ter pelo menos 6 caracteres.";
  if (m.includes("same password") || m.includes("different from the old")) return "A nova senha precisa ser diferente da atual.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("link")) return "O link expirou. Peça um novo em “Esqueci a senha”.";
  if (m.includes("fetch") || m.includes("network")) return "Sem conexão. Confira a internet e tente de novo.";
  return mensagem ? `Não foi possível concluir: ${mensagem}` : "Algo deu errado. Tente de novo.";
}
