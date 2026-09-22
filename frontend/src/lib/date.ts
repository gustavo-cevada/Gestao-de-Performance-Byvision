// Helpers de data em pt-BR para o filtro de período.

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_LONGO = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// "2026-09" -> "Setembro 2026"
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES_LONGO[(m || 1) - 1]} ${y}`;
}

// "2026-09" -> "Set/26"
export function monthChip(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MESES[(m || 1) - 1]}/${String(y).slice(2)}`;
}

// "2026-09-15" -> "15/09/2026"
export function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

// "2026-09-15" -> "15 de Setembro"
export function dayLong(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d} de ${MESES_LONGO[(m || 1) - 1]}`;
}

// Dias úteis (seg-sex) de um mês -> lista de números de dia
export function businessDaysOfMonth(ym: string): number[] {
  const [y, m] = ym.split("-").map(Number);
  const days: number[] = [];
  const total = new Date(y, m, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    if (wd >= 1 && wd <= 5) days.push(d);
  }
  return days;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
