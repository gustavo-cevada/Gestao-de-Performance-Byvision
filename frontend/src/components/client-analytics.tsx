import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Icon } from "@/src/components/icon";
import { formatBRL } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type Pedido = { id_pedido: number; data: string; valor: number; tipos: string[] };
export type ItemVenda = {
  id_pedido: number;
  data: string;
  familia: string | null;
  codigo: string;
  sku: string | null;
  tipo: string | null;
  grupo: string | null;
  marca: string | null;
  qtd: number;
  valor: number;
};
export type Mensal = { mes: string; valor: number };

type Props = {
  mensais: Mensal[];
  pedidos: Pedido[];
  itens: ItemVenda[];
  metaMensal: number;
  refMonth: string; // YYYY-MM
  refExp: number; // 0..1 ritmo de dias úteis do mês corrente
  diasUteisRef: number; // dias úteis do mês de referência (líquido de feriados)
  asOf?: string; // data "hoje" (YYYY-MM-DD) — limita dias renderizados no mês corrente
};

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function monthShort(ym: string) {
  const [y, m] = ym.split("-");
  return `${MESES[Number(m) - 1] ?? m}/${y.slice(2)}`;
}
function monthLong(ym: string) {
  const nomes = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const [y, m] = ym.split("-");
  return `${nomes[Number(m) - 1] ?? m} de ${y}`;
}
function prevMonths(ym: string, n: number): string[] {
  const [y, m] = ym.split("-").map(Number);
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    let mm = m - i;
    let yy = y;
    while (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    out.push(`${yy}-${String(mm).padStart(2, "0")}`);
  }
  return out;
}
function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}
function isWeekday(ym: string, day: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, day).getDay();
  return d >= 1 && d <= 5;
}

// Rótulo do tipo, a partir da classificação canônica vinda do backend
// (SURFACADO / ACABADO / SERVICO / CONFERIR).
function tipoLabel(t: string | null | undefined): string {
  const u = (t || "").toUpperCase();
  if (u === "SURFACADO") return "Surfaçado";
  if (u === "ACABADO") return "Acabado";
  if (u === "SERVICO") return "Serviço";
  if (u === "CONFERIR") return "Conferir";
  return t ? t.charAt(0) + t.slice(1).toLowerCase() : "—";
}
// Cor por tipo: Surfaçado=brand, Acabado=warning, Serviço=info/muted, Conferir=erro (para chamar atenção)
function tipoColor(t: string | null | undefined, colors: any): string {
  const u = (t || "").toUpperCase();
  if (u === "SURFACADO") return colors.brand;
  if (u === "ACABADO") return colors.warning;
  if (u === "SERVICO") return colors.onSurfaceSecondary;
  return colors.error; // CONFERIR / desconhecido
}
function media(map: Record<string, number>, months: string[]): { avg: number; n: number } {
  const vals = months.map((m) => map[m] ?? 0).filter((v) => v > 0);
  if (!vals.length) return { avg: 0, n: 0 };
  return { avg: vals.reduce((a, b) => a + b, 0) / vals.length, n: vals.length };
}

export function ClientAnalytics({ mensais, pedidos, itens, metaMensal, refMonth, refExp, diasUteisRef, asOf }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  const monthScrollRef = useRef<ScrollView>(null);
  const dayScrollRef = useRef<ScrollView>(null);

  const mensalMap = useMemo(() => {
    const m: Record<string, number> = {};
    mensais.forEach((x) => (m[x.mes] = x.valor));
    return m;
  }, [mensais]);

  // últimos 12 meses (inclui refMonth) em ordem crescente
  const chartMonths = useMemo(() => {
    const set = new Set<string>([refMonth, ...prevMonths(refMonth, 11)]);
    mensais.forEach((x) => set.add(x.mes));
    return Array.from(set).sort().slice(-12);
  }, [mensais, refMonth]);

  const [selMonth, setSelMonth] = useState<string>(refMonth);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [topWindow, setTopWindow] = useState<number>(12);
  const [topN, setTopN] = useState<number>(10);
  const [topNText, setTopNText] = useState<string>("10");
  const [recentSort, setRecentSort] = useState<"data" | "valor">("data");
  const [recentTipo, setRecentTipo] = useState<"todos" | "SURFACADO" | "ACABADO">("todos");

  // ---- indicadores do mês selecionado ----
  const fatMes = mensalMap[selMonth] ?? 0;
  const media12 = useMemo(() => media(mensalMap, prevMonths(refMonth, 12)), [mensalMap, refMonth]);

  const ticketSurf = useMemo(() => {
    const surf = itens.filter((it) => (it.tipo || "").toUpperCase() === "SURFACADO" && it.data.slice(0, 7) === selMonth);
    if (!surf.length) return null;
    const receita = surf.reduce((a, b) => a + b.valor, 0);
    const pedidosDistintos = new Set(surf.map((s) => s.id_pedido)).size;
    return pedidosDistintos > 0 ? receita / pedidosDistintos : null;
  }, [itens, selMonth]);

  const tendencia = useMemo(() => {
    const isRef = selMonth === refMonth;
    const base = media(mensalMap, prevMonths(selMonth, 3)).avg;
    if (base <= 0) return null;
    const atual = isRef && refExp > 0.05 ? fatMes / refExp : fatMes;
    const varPct = (atual - base) / base;
    const dir = varPct > 0.05 ? "up" : varPct < -0.05 ? "down" : "flat";
    return { varPct, dir, isRef };
  }, [mensalMap, selMonth, refMonth, fatMes, refExp]);

  // ---- gráfico mensal ----
  const maxMensal = Math.max(1, ...chartMonths.map((m) => mensalMap[m] ?? 0), metaMensal || 0);

  // ---- gráfico diário do mês selecionado ----
  // não renderiza dias futuros: no mês corrente (== asOf) limita ao dia de hoje;
  // meses passados vão até o último dia do mês. Só dias úteis (+ não úteis c/ faturamento).
  const dailyBars = useMemo(() => {
    const totalDays = daysInMonth(selMonth);
    const isCurrent = !!asOf && asOf.slice(0, 7) === selMonth;
    const lastDay = isCurrent ? Math.min(totalDays, Number(asOf!.slice(8, 10))) : totalDays;
    const byDay: Record<string, number> = {};
    pedidos.forEach((p) => {
      if (p.data.slice(0, 7) === selMonth) byDay[p.data] = (byDay[p.data] ?? 0) + p.valor;
    });
    return Array.from({ length: lastDay }, (_, i) => {
      const day = i + 1;
      const key = `${selMonth}-${String(day).padStart(2, "0")}`;
      return { day, key, valor: byDay[key] ?? 0, weekday: isWeekday(selMonth, day) };
    }).filter((d) => d.weekday || d.valor > 0); // só dias úteis (+ não úteis com faturamento)
  }, [pedidos, selMonth, asOf]);
  const maxDaily = Math.max(1, ...dailyBars.map((d) => d.valor));
  const metaDia = selMonth === refMonth && metaMensal > 0 && diasUteisRef > 0 ? metaMensal / diasUteisRef : 0;

  // Posição inicial dos gráficos no período mais recente (mês/dia atual à direita).
  useEffect(() => {
    const t = setTimeout(() => monthScrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(t);
  }, []);
  // Ao trocar o mês, reposiciona o gráfico diário no dia mais recente disponível.
  useEffect(() => {
    const t = setTimeout(() => dayScrollRef.current?.scrollToEnd({ animated: false }), 60);
    return () => clearTimeout(t);
  }, [selMonth, dailyBars.length]);

  // ---- produtos do dia ----
  const produtosDia = useMemo(() => {
    if (!selDay) return [];
    const rows: Record<string, { familia: string | null; codigos: Set<string>; tipo: string | null; qtd: number; valor: number }> = {};
    itens
      .filter((it) => it.data === selDay)
      .forEach((it) => {
        const key = (it.familia || "") + "|" + (it.tipo || "");
        const r = (rows[key] ||= { familia: it.familia, codigos: new Set(), tipo: it.tipo, qtd: 0, valor: 0 });
        if (it.codigo) r.codigos.add(it.codigo);
        r.qtd += it.qtd;
        r.valor += it.valor;
      });
    return Object.values(rows).sort((a, b) => b.valor - a.valor);
  }, [itens, selDay]);

  // ---- top produtos (janela independente) ----
  const topProdutos = useMemo(() => {
    const wMonths = new Set<string>([refMonth, ...prevMonths(refMonth, topWindow - 1)]);
    const rows: Record<string, { familia: string | null; codigos: Set<string>; tipo: string | null; qtd: number; valor: number }> = {};
    itens
      .filter((it) => wMonths.has(it.data.slice(0, 7)))
      .forEach((it) => {
        const key = (it.familia || it.codigo) + "|" + (it.tipo || "");
        const r = (rows[key] ||= { familia: it.familia, codigos: new Set(), tipo: it.tipo, qtd: 0, valor: 0 });
        if (it.codigo) r.codigos.add(it.codigo);
        r.qtd += it.qtd;
        r.valor += it.valor;
      });
    return Object.values(rows).sort((a, b) => b.valor - a.valor || (a.familia || "").localeCompare(b.familia || ""));
  }, [itens, topWindow, refMonth]);

  // ---- compras recentes ----
  const recentes = useMemo(() => {
    let list = pedidos.slice();
    if (recentTipo !== "todos") list = list.filter((p) => p.tipos.map((t) => t.toUpperCase()).includes(recentTipo));
    list.sort((a, b) => (recentSort === "valor" ? b.valor - a.valor : b.data.localeCompare(a.data)));
    return list.slice(0, 40);
  }, [pedidos, recentSort, recentTipo]);
  const maxRecent = Math.max(1, ...recentes.map((r) => r.valor));

  const barColor = colors.brand;

  return (
    <View style={{ gap: 16 }}>
      {/* ================= FATURAMENTO POR MÊS ================= */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>Faturamento por mês</Text>
          <View style={styles.monthTag}>
            <Icon name="calendar-month" size={13} color={colors.brand} />
            <Text style={styles.monthTagText}>{monthLong(selMonth)}</Text>
          </View>
        </View>

        {/* 4 indicadores */}
        <View style={styles.indGrid}>
          <Indicator label="Faturamento do mês" value={formatBRL(fatMes)} />
          <Indicator label="Média de compra/mês" value={media12.n ? formatBRL(media12.avg) : "—"} hint={media12.n ? `12 meses (${media12.n} c/ compra)` : "sem histórico"} />
          <Indicator label="Ticket médio de surfaçados" value={ticketSurf != null ? formatBRL(ticketSurf) : "Sem pedidos surfaçados"} hint={ticketSurf != null ? "por pedido no mês" : "no mês selecionado"} />
          <TrendIndicator t={tendencia} />
        </View>

        {/* gráfico de barras mensal */}
        <ScrollView ref={monthScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScroll}>
          {chartMonths.map((ym) => {
            const v = mensalMap[ym] ?? 0;
            const h = Math.max(2, (v / maxMensal) * 120);
            const isSel = ym === selMonth;
            const hasMeta = ym === refMonth && metaMensal > 0;
            const metaH = hasMeta ? Math.max(2, (metaMensal / maxMensal) * 120) : 0;
            return (
              <Pressable key={ym} style={styles.monthCol} onPress={() => { setSelMonth(ym); setSelDay(null); }} testID={`month-${ym}`}>
                <Text style={styles.barValueTop} numberOfLines={1}>{v > 0 ? formatBRL(v).replace("R$", "").trim() : ""}</Text>
                <View style={styles.barArea}>
                  <View style={[styles.bar, { height: h, backgroundColor: isSel ? colors.brand : colors.brandTertiary }]} />
                  {hasMeta && <View style={[styles.metaLine, { bottom: metaH }]} />}
                </View>
                <Text style={[styles.barLabel, isSel && { color: colors.brand, fontFamily: fonts.bold }]}>{monthShort(ym)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}><View style={[styles.legendDash]} /><Text style={styles.legendText}>Meta do mês (só mês atual)</Text></View>
          <Text style={styles.legendText}>Demais meses: sem meta cadastrada</Text>
        </View>
      </View>

      {/* ================= FATURAMENTO POR DIA ================= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Faturamento por dia — {monthLong(selMonth)}</Text>
        <ScrollView ref={dayScrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayScroll}>
          <View style={styles.dayInner}>
            {metaDia > 0 && (
              <View style={[styles.metaLineDaily, { top: 6 + (110 - Math.max(1, (metaDia / maxDaily) * 110)) }]} />
            )}
            {dailyBars.map((d) => {
              const h = Math.max(2, (d.valor / maxDaily) * 110);
              const isSel = selDay === d.key;
              return (
                <Pressable key={d.key} style={styles.dayCol} onPress={() => setSelDay(isSel ? null : d.key)} testID={`day-${d.key}`}>
                  <View style={styles.dayBarArea}>
                    <View style={[styles.dayBar, { height: h, backgroundColor: isSel ? colors.brand : d.valor > 0 ? colors.brandTertiary : colors.surfaceTertiary }]} />
                  </View>
                  <Text style={[styles.dayLabel, isSel && { color: colors.brand, fontFamily: fonts.bold }, !d.weekday && { color: colors.muted }]}>{d.day}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
        <Text style={styles.hintText}>
          {metaDia > 0
            ? `Meta diária (dias úteis): ${formatBRL(metaDia)} — não distribuída em fins de semana/feriados.`
            : "Sem meta cadastrada para este mês."}
        </Text>
        {selDay && <Text style={styles.hintText}>Dia selecionado: {selDay.split("-").reverse().join("/")}</Text>}
      </View>

      {/* ================= PRODUTOS COMPRADOS NO DIA ================= */}
      {selDay && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Produtos comprados no dia</Text>
          {produtosDia.length === 0 ? (
            <Text style={styles.muted}>Nenhum produto faturado neste dia.</Text>
          ) : (
            <ProductTable rows={produtosDia} />
          )}
        </View>
      )}

      {/* ================= TOP PRODUTOS ================= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Top produtos mais vendidos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {[
            { n: 12, l: "12 meses" },
            { n: 6, l: "6 meses" },
            { n: 3, l: "3 meses" },
            { n: 2, l: "2 meses" },
            { n: 1, l: "Mês atual" },
          ].map((o) => (
            <Pressable key={o.n} style={[styles.chip, topWindow === o.n && styles.chipActive]} onPress={() => setTopWindow(o.n)} testID={`topwin-${o.n}`}>
              <Text style={[styles.chipText, topWindow === o.n && styles.chipTextActive]}>{o.l}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.topNRow}>
          <Text style={styles.hintText}>Mostrar</Text>
          <TextInput
            value={topNText}
            onChangeText={(t) => { const clean = t.replace(/[^0-9]/g, "").slice(0, 3); setTopNText(clean); setTopN(Math.max(1, Number(clean) || 1)); }}
            keyboardType="number-pad"
            style={styles.topNInput}
            testID="topn-input"
          />
          <Text style={styles.hintText}>de {topProdutos.length}</Text>
          <Pressable style={styles.linkBtn} onPress={() => { setTopN(topProdutos.length); setTopNText(String(topProdutos.length)); }} testID="topn-all">
            <Text style={styles.linkText}>Ver todos</Text>
          </Pressable>
        </View>
        {topProdutos.length === 0 ? (
          <Text style={styles.muted}>Sem produtos na janela selecionada.</Text>
        ) : (
          <ProductTable rows={topProdutos.slice(0, topN)} rank />
        )}
      </View>

      {/* ================= COMPRAS RECENTES ================= */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Compras recentes</Text>
        <View style={styles.filterRow}>
          <SmallChip active={recentSort === "data"} label="Data" onPress={() => setRecentSort("data")} />
          <SmallChip active={recentSort === "valor"} label="Valor" onPress={() => setRecentSort("valor")} />
          <View style={styles.filterSpacer} />
          <SmallChip active={recentTipo === "todos"} label="Todos" onPress={() => setRecentTipo("todos")} />
          <SmallChip active={recentTipo === "SURFACADO"} label="Surf." onPress={() => setRecentTipo("SURFACADO")} />
          <SmallChip active={recentTipo === "ACABADO"} label="Acab." onPress={() => setRecentTipo("ACABADO")} />
        </View>
        {recentes.length === 0 ? (
          <Text style={styles.muted}>Nenhuma compra encontrada.</Text>
        ) : (
          <View style={{ gap: 14 }}>
            {recentes.map((p, i) => {
              const w = Math.max(4, (p.valor / maxRecent) * 100);
              return (
                <View key={`${p.id_pedido}-${i}`} style={{ gap: 6 }}>
                  <View style={styles.recentTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recentDate}>{p.data.split("-").reverse().join("/")}</Text>
                      <View style={styles.tipoTags}>
                        <Text style={styles.recentPed}>Pedido {p.id_pedido}</Text>
                        {p.tipos.map((t) => (
                          <View key={t} style={[styles.tipoTag, { borderColor: tipoColor(t, colors) }]}>
                            <Text style={[styles.tipoTagText, { color: tipoColor(t, colors) }]}>{tipoLabel(t)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <Text style={styles.recentValue}>{formatBRL(p.valor)}</Text>
                  </View>
                  <View style={styles.recentTrack}><View style={[styles.recentFill, { width: `${w}%`, backgroundColor: barColor }]} /></View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

function Indicator({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.ind}>
      <Text style={styles.indValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      <Text style={styles.indLabel}>{label}</Text>
      {!!hint && <Text style={styles.indHint}>{hint}</Text>}
    </View>
  );
}

function TrendIndicator({ t }: { t: { varPct: number; dir: string; isRef: boolean } | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!t) return <Indicator label="Tendência" value="—" hint="sem base" />;
  const color = t.dir === "up" ? colors.success : t.dir === "down" ? colors.error : colors.muted;
  const icon = t.dir === "up" ? "trending-up" : t.dir === "down" ? "trending-down" : "trending-neutral";
  const txt = t.dir === "up" ? "Crescimento" : t.dir === "down" ? "Queda" : "Estável";
  const pct = `${t.varPct >= 0 ? "+" : ""}${Math.round(t.varPct * 100)}%`;
  return (
    <View style={styles.ind}>
      <View style={styles.trendTop}>
        <Icon name={icon as any} size={18} color={color} />
        <Text style={[styles.indValue, { color }]}>{pct}</Text>
      </View>
      <Text style={styles.indLabel}>Tendência: {txt}</Text>
      <Text style={styles.indHint}>{t.isRef ? "projeção vs média 3 meses" : "vs média dos 3 meses anteriores"}</Text>
    </View>
  );
}

type PRow = { familia: string | null; codigos: Set<string> | string[]; tipo: string | null; qtd: number; valor: number };

// Grade de produtos com rolagem horizontal (preserva colunas e nomes completos,
// sem abreviar nem cortar). Cabeçalho alinhado; código menor abaixo do nome.
function ProductTable({ rows, rank }: { rows: PRow[]; rank?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const W = { rank: 30, tipo: 96, prod: 220, un: 62, total: 108 };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      nestedScrollEnabled
      contentContainerStyle={{ minWidth: "100%" }}
    >
      <View>
        <View style={styles.prodHead}>
          {rank && <Text style={[styles.prodH, { width: W.rank }]}>#</Text>}
          <Text style={[styles.prodH, { width: W.tipo }]}>Tipo</Text>
          <Text style={[styles.prodH, { width: W.prod }]}>Produto</Text>
          <Text style={[styles.prodH, { width: W.un, textAlign: "right" }]}>Qtd (UN)</Text>
          <Text style={[styles.prodH, { width: W.total, textAlign: "right" }]}>Total (R$)</Text>
        </View>
        {rows.map((r, i) => {
          const codigos = Array.isArray(r.codigos) ? r.codigos : Array.from(r.codigos);
          const codeLabel = codigos.length <= 1 ? codigos[0] || "—" : `${codigos.slice().sort()[0]} +${codigos.length - 1}`;
          const col = tipoColor(r.tipo, colors);
          return (
            <View key={i} style={styles.prodRow}>
              {rank && <Text style={[styles.prodRank, { width: W.rank }]}>{i + 1}</Text>}
              <View style={{ width: W.tipo }}>
                <View style={[styles.prodTipo, { borderColor: col }]}>
                  <Text style={[styles.prodTipoText, { color: col }]} numberOfLines={1}>{tipoLabel(r.tipo)}</Text>
                </View>
              </View>
              <View style={{ width: W.prod, paddingRight: 10 }}>
                <Text style={styles.prodName}>{r.familia || "—"}</Text>
                <Text style={styles.prodCode}>{codeLabel}</Text>
              </View>
              <Text style={[styles.prodQtd, { width: W.un }]}>{Math.round(r.qtd)}</Text>
              <Text style={[styles.prodTotal, { width: W.total }]}>{formatBRL(r.valor)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function SmallChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable style={[styles.smallChip, active && styles.smallChipActive]} onPress={onPress}>
      <Text style={[styles.smallChipText, active && styles.smallChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, paddingVertical: 8 },
  hintText: { fontFamily: fonts.regular, fontSize: 11.5, color: c.muted },
  monthTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: c.surfaceTertiary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  monthTagText: { fontFamily: fonts.semibold, fontSize: 11.5, color: c.onSurface, textTransform: "capitalize" },

  indGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  ind: { flexBasis: "47%", flexGrow: 1, backgroundColor: c.surfaceTertiary, borderRadius: 12, padding: 12, gap: 3 },
  indValue: { fontFamily: fonts.numBold, fontSize: 18, color: c.onSurface },
  indLabel: { fontFamily: fonts.semibold, fontSize: 11.5, color: c.onSurfaceSecondary },
  indHint: { fontFamily: fonts.regular, fontSize: 10, color: c.muted },
  trendTop: { flexDirection: "row", alignItems: "center", gap: 6 },

  monthScroll: { gap: 10, paddingVertical: 6, paddingRight: 8 },
  monthCol: { alignItems: "center", width: 46, gap: 4 },
  barArea: { height: 120, width: 26, justifyContent: "flex-end", position: "relative" },
  bar: { width: 26, borderRadius: 6 },
  barValueTop: { fontFamily: fonts.numMedium, fontSize: 8.5, color: c.muted, height: 12 },
  barLabel: { fontFamily: fonts.medium, fontSize: 10.5, color: c.onSurfaceSecondary },
  metaLine: { position: "absolute", left: -4, right: -4, height: 2, backgroundColor: c.warning, borderRadius: 1 },
  legendRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDash: { width: 16, height: 2, backgroundColor: c.warning, borderRadius: 1 },
  legendText: { fontFamily: fonts.regular, fontSize: 10.5, color: c.muted },

  dayScroll: { paddingVertical: 6, paddingRight: 8 },
  dayInner: { flexDirection: "row", alignItems: "flex-start", gap: 6, position: "relative", paddingVertical: 6 },
  dayCol: { alignItems: "center", width: 22, gap: 4 },
  dayBarArea: { height: 110, width: 16, justifyContent: "flex-end", position: "relative" },
  dayBar: { width: 16, borderRadius: 4 },
  metaLineDaily: { position: "absolute", left: 0, right: 0, height: 2, backgroundColor: c.warning, borderRadius: 1, zIndex: 2 },
  metaTickDay: { position: "absolute", left: -3, right: -3, height: 1.5, backgroundColor: c.warning },
  dayLabel: { fontFamily: fonts.numMedium, fontSize: 9.5, color: c.onSurfaceSecondary },

  prodHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.border },
  prodH: { fontFamily: fonts.semibold, fontSize: 10.5, color: c.muted, textTransform: "uppercase" },
  prodRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  prodRank: { fontFamily: fonts.numBold, fontSize: 12, color: c.muted, textAlign: "center", paddingTop: 2 },
  prodTipo: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, alignSelf: "flex-start" },
  prodTipoText: { fontFamily: fonts.semibold, fontSize: 9.5 },
  prodName: { fontFamily: fonts.semibold, fontSize: 12.5, color: c.onSurface, lineHeight: 16 },
  prodCode: { fontFamily: fonts.numMedium, fontSize: 10.5, color: c.muted, marginTop: 1 },
  prodQtd: { fontFamily: fonts.numMedium, fontSize: 12, color: c.onSurface, textAlign: "right", paddingTop: 2 },
  prodTotal: { fontFamily: fonts.numBold, fontSize: 12, color: c.onSurface, textAlign: "right", paddingTop: 2 },

  chipRow: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 999, paddingHorizontal: 12, height: 32, justifyContent: "center" },
  chipActive: { backgroundColor: c.brandPrimary, borderColor: c.brandPrimary },
  chipText: { fontFamily: fonts.semibold, fontSize: 12, color: c.onSurfaceSecondary },
  chipTextActive: { color: c.onBrandPrimary },
  topNRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  topNInput: { backgroundColor: c.surfaceTertiary, borderRadius: 8, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 10, height: 36, width: 60, fontFamily: fonts.numBold, fontSize: 15, color: c.onSurface, textAlign: "center" },
  linkBtn: { marginLeft: "auto" },
  linkText: { fontFamily: fonts.bold, fontSize: 12.5, color: c.brand },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  filterSpacer: { flex: 1 },
  smallChip: { borderWidth: 1, borderColor: c.borderStrong, borderRadius: 999, paddingHorizontal: 10, height: 28, justifyContent: "center" },
  smallChipActive: { backgroundColor: c.brandTertiary, borderColor: c.brand },
  smallChipText: { fontFamily: fonts.medium, fontSize: 11.5, color: c.onSurfaceSecondary },
  smallChipTextActive: { color: c.brand, fontFamily: fonts.bold },

  recentTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  recentDate: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  tipoTags: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", marginTop: 2 },
  recentPed: { fontFamily: fonts.regular, fontSize: 11, color: c.muted },
  tipoTag: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  tipoTagText: { fontFamily: fonts.semibold, fontSize: 9.5 },
  recentValue: { fontFamily: fonts.numBold, fontSize: 14, color: c.onSurface },
  recentTrack: { height: 8, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  recentFill: { height: "100%", borderRadius: 4 },
}));
