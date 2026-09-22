// Formatação BR (R$ e %).

export function formatBRL(value: number | null | undefined, withSymbol = true): string {
  const n = Number(value ?? 0);
  const neg = n < 0;
  const abs = Math.abs(n);
  const [intPart, decPart] = abs.toFixed(2).split(".");
  const withDots = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const body = `${withDots},${decPart}`;
  return `${neg ? "-" : ""}${withSymbol ? "R$ " : ""}${body}`;
}

export function formatPct(frac: number | null | undefined, decimals = 0): string {
  if (frac === null || frac === undefined) return "—";
  return `${(frac * 100).toFixed(decimals)}%`;
}

export function formatCompact(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const abs = Math.abs(n);
  if (abs >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return formatBRL(n);
}

// "2026-09-15" -> "15/09/2026"
export function formatDateBR(ymd: string | null | undefined): string {
  if (!ymd) return "—";
  const s = String(ymd).slice(0, 10);
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}
