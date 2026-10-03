import { FUSO, HORA_DO_SLOT, type TipoConteudo } from "@/config/cliente";

/** Dia no calendário de Brasília, no formato AAAA-MM-DD. */
export type ChaveDia = string;

export interface PartesBrasilia {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  diaSemana: number; // 0 = domingo
}

const formatador = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const DIAS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function partesBrasilia(data: Date | string): PartesBrasilia {
  const d = typeof data === "string" ? new Date(data) : data;
  const p: Record<string, string> = {};
  for (const parte of formatador.formatToParts(d)) p[parte.type] = parte.value;
  return {
    ano: Number(p.year),
    mes: Number(p.month),
    dia: Number(p.day),
    hora: Number(p.hour),
    minuto: Number(p.minute),
    diaSemana: DIAS_EN.indexOf(p.weekday),
  };
}

function deslocamentoMs(instante: number): number {
  const d = new Date(instante);
  const p: Record<string, string> = {};
  for (const parte of formatador.formatToParts(d)) p[parte.type] = parte.value;
  const comoUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return comoUtc - Math.floor(instante / 1000) * 1000;
}

/** Instante (UTC) correspondente a uma data/hora de parede em Brasília. */
export function deBrasilia(ano: number, mes: number, dia: number, hora = 0, minuto = 0): Date {
  const parede = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let instante = parede - deslocamentoMs(parede);
  instante = parede - deslocamentoMs(instante);
  return new Date(instante);
}

const dois = (n: number) => String(n).padStart(2, "0");

export function chaveDia(data: Date | string): ChaveDia {
  const p = partesBrasilia(data);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}`;
}

export function partesDaChave(chave: ChaveDia): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return { ano, mes, dia };
}

export function somarDias(chave: ChaveDia, dias: number): ChaveDia {
  const { ano, mes, dia } = partesDaChave(chave);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
}

export function diaDaSemana(chave: ChaveDia): number {
  const { ano, mes, dia } = partesDaChave(chave);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Início do dia (00:00 de Brasília) em UTC. */
export function inicioDoDia(chave: ChaveDia): Date {
  const { ano, mes, dia } = partesDaChave(chave);
  return deBrasilia(ano, mes, dia, 0, 0);
}

/** dd/mm/aaaa hh:mm em Brasília. */
export function formatarDataHora(data: Date | string | null | undefined): string {
  if (!data) return "—";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "—";
  const p = partesBrasilia(d);
  return `${dois(p.dia)}/${dois(p.mes)}/${p.ano} ${dois(p.hora)}:${dois(p.minuto)}`;
}

export function formatarData(data: Date | string | null | undefined): string {
  return formatarDataHora(data).split(" ")[0];
}

export function formatarDiaMes(data: Date | string | null | undefined): string {
  return formatarData(data).slice(0, 5);
}

export function formatarHora(data: Date | string): string {
  const p = partesBrasilia(data);
  return `${dois(p.hora)}:${dois(p.minuto)}`;
}

/** Valor para <input type="datetime-local"> em Brasília. */
export function paraInputLocal(data: Date | string): string {
  const p = partesBrasilia(data);
  return `${p.ano}-${dois(p.mes)}-${dois(p.dia)}T${dois(p.hora)}:${dois(p.minuto)}`;
}

/** Lê o valor de um <input type="datetime-local"> como horário de Brasília. */
export function deInputLocal(valor: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(valor);
  if (!m) throw new Error("Data/hora inválida.");
  const [, a, me, d, h, mi] = m.map(Number);
  return deBrasilia(a, me, d, h, mi);
}

/** Instante do slot de um tipo num dia de Brasília. */
export function instanteDoSlot(tipo: TipoConteudo, chave: ChaveDia): Date {
  const { ano, mes, dia } = partesDaChave(chave);
  const { hora, minuto } = HORA_DO_SLOT[tipo];
  return deBrasilia(ano, mes, dia, hora, minuto);
}

export function horaDoSlotTexto(tipo: TipoConteudo): string {
  const { hora, minuto } = HORA_DO_SLOT[tipo];
  return `${dois(hora)}:${dois(minuto)}`;
}

/** "O slot de hoje já passou" — sempre em Brasília. */
export function slotJaPassou(tipo: TipoConteudo, chave: ChaveDia, agora: Date = new Date()): boolean {
  return instanteDoSlot(tipo, chave).getTime() <= agora.getTime();
}

export interface DiaDaGrade {
  chave: ChaveDia;
  dia: number;
  doMes: boolean;
}

/** Posição na semana começando na segunda (0 = segunda … 6 = domingo). */
function posicaoNaSemana(chave: ChaveDia): number {
  return (diaDaSemana(chave) + 6) % 7;
}

/** Grade do mês (segunda a domingo), sempre com semanas completas. */
export function gradeMes(ano: number, mes: number): DiaDaGrade[] {
  const primeiro = `${ano}-${dois(mes)}-01`;
  const inicio = somarDias(primeiro, -posicaoNaSemana(primeiro));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const ultimo = `${ano}-${dois(mes)}-${dois(diasNoMes)}`;
  const fim = somarDias(ultimo, 6 - posicaoNaSemana(ultimo));
  const dias: DiaDaGrade[] = [];
  for (let c = inicio; c <= fim; c = somarDias(c, 1)) {
    const p = partesDaChave(c);
    dias.push({ chave: c, dia: p.dia, doMes: p.mes === mes && p.ano === ano });
  }
  return dias;
}

/** Os 7 dias (segunda a domingo) da semana que contém `chave`. */
export function gradeSemana(chave: ChaveDia): ChaveDia[] {
  const inicio = somarDias(chave, -posicaoNaSemana(chave));
  return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
}

/** Intervalo [de, ate) em UTC que cobre do primeiro ao último dia (inclusive). */
export function intervaloUtc(primeiro: ChaveDia, ultimo: ChaveDia): { de: string; ate: string } {
  return { de: inicioDoDia(primeiro).toISOString(), ate: inicioDoDia(somarDias(ultimo, 1)).toISOString() };
}

export const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const NOMES_DIA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Cabeçalho das grades, na ordem em que aparecem (segunda primeiro). */
export const NOMES_DIA_GRADE = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
