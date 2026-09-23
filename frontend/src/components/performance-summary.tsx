import { Text, View } from "react-native";

import { Icon } from "@/src/components/icon";
import { KpiCard } from "@/src/components/kpi-card";
import { formatBRL } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type Kpi = {
  meta_vendas: number;
  vendas_realizadas: number;
  venda_provisionada: number;
  gap_valor: number;
  gap_pct: number;
  pct_atingimento_realizado: number;
  pct_atingimento_provisionado: number;
  meta_do_dia: number;
};

export type ScopeInfo = {
  day_mode: boolean;
  day: string | null;
  total_dias_uteis: number;
  dias_uteis_decorridos: number;
  dias_uteis_restantes: number;
};

function signedPct(frac: number): string {
  const sign = frac < 0 ? "-" : "+";
  return `${sign}${Math.round(Math.abs(frac) * 100)}%`;
}

function signedBRL(n: number): string {
  const sign = n < 0 ? "-" : "+";
  return `R$ ${sign}${formatBRL(Math.abs(n), false)}`;
}

export function PerformanceSummary({ k, scope }: { k: Kpi; scope: ScopeInfo }) {
  const styles = useStyles();
  const { colors } = useTheme();

  const dayMode = scope.day_mode;
  const pctReal = k.pct_atingimento_realizado;
  const pctPrev = k.pct_atingimento_provisionado;
  const ritmo = pctPrev > 0 ? pctReal / pctPrev : pctReal >= 1 ? 1 : 0;
  const tone = ritmo >= 1 ? colors.success : ritmo >= 0.76 ? colors.warning : colors.error;
  const toneKey: "success" | "warning" | "error" = ritmo >= 1 ? "success" : ritmo >= 0.76 ? "warning" : "error";

  const gapPctSigned = -k.gap_pct;
  const gapValorSigned = -k.gap_valor;
  const faltaMeta = Math.max(0, k.meta_vendas - k.vendas_realizadas);

  const realW = Math.max(0, Math.min(1, pctReal)) * 100;
  const prevW = Math.max(0, Math.min(1, pctPrev)) * 100;

  return (
    <View style={styles.wrap}>
      {/* Três cartões de percentual */}
      <View style={styles.pctRow}>
        <PctStat value={`${Math.round(pctReal * 100)}%`} label="Faturado" color={tone} testID="pct-faturado" />
        <PctStat value={`${Math.round(pctPrev * 100)}%`} label="Previsionado" color={colors.onSurface} testID="pct-previsionado" />
        <PctStat value={signedPct(gapPctSigned)} label="Gap falta (%)" color={tone} testID="pct-gap" />
      </View>

      {/* Cartão de progresso + meta */}
      <View style={styles.hero}>
        <Text style={styles.progressTitle}>Progresso da Meta de Vendas</Text>
        <View style={styles.track}>
          <View style={[styles.fillLight, { width: `${prevW}%`, backgroundColor: tone }]} />
          <View style={[styles.fill, { width: `${realW}%`, backgroundColor: tone }]} />
        </View>

        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>{dayMode ? "META DO DIA" : "META DE VENDAS DO MÊS"}</Text>
          <Text style={styles.metaValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {formatBRL(k.meta_vendas)}
          </Text>
          {!dayMode && (
            <>
              <Text style={styles.metaHint}>
                {`${scope.dias_uteis_decorridos} de ${scope.total_dias_uteis} dias úteis · ${scope.dias_uteis_restantes} restantes`}
              </Text>
              <View style={styles.metaDayChip}>
                <Icon name="target" size={14} color={colors.onBrandTertiary} />
                <Text style={styles.metaDayText}>
                  Meta do dia: <Text style={styles.metaDayValue}>{formatBRL(k.meta_do_dia)}</Text>/dia útil restante
                </Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Grade de KPIs */}
      <View style={styles.grid}>
        <KpiCard label={dayMode ? "Vendas do dia" : "Faturado"} value={formatBRL(k.vendas_realizadas)} icon="cash-check" testID="kpi-realizada" />
        <KpiCard label={dayMode ? "Previsionado do dia" : "Previsionado"} value={formatBRL(k.venda_provisionada)} icon="chart-timeline-variant" testID="kpi-provisionada" />
      </View>
      <View style={styles.grid}>
        <KpiCard
          label="Gap (falta) R$"
          value={signedBRL(gapValorSigned)}
          icon={gapValorSigned < 0 ? "trending-down" : "trending-up"}
          tone={toneKey}
          testID="kpi-gap-valor"
        />
        <KpiCard label="Falta para a meta" value={formatBRL(faltaMeta)} icon="flag-checkered" testID="kpi-falta-meta" />
      </View>
    </View>
  );
}

function PctStat({ value, label, color, testID }: { value: string; label: string; color: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.pctCard} testID={testID}>
      <Text style={[styles.pctValue, { color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
        {value}
      </Text>
      <Text style={styles.pctLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: 12 },
  pctRow: { flexDirection: "row", gap: 10 },
  pctCard: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    gap: 2,
  },
  pctValue: { fontFamily: fonts.numBold, fontSize: 28, lineHeight: 32 },
  pctLabel: { fontFamily: fonts.medium, fontSize: 12, color: c.muted },

  hero: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 20,
    gap: 16,
  },
  progressTitle: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurfaceSecondary, textAlign: "center" },
  track: {
    height: 26,
    borderRadius: 6,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
    position: "relative",
  },
  fillLight: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.32 },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },

  metaBox: { alignItems: "center", gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: c.divider, width: "100%" },
  metaLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5 },
  metaValue: { fontFamily: fonts.numBold, fontSize: 30, color: c.onSurface },
  metaHint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  metaDayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.brandTertiary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 2,
  },
  metaDayText: { fontFamily: fonts.regular, fontSize: 12, color: c.onBrandTertiary },
  metaDayValue: { fontFamily: fonts.numBold, fontSize: 12, color: c.onBrandTertiary },

  grid: { flexDirection: "row", gap: 12 },
}));
