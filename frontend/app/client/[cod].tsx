import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { Icon, IconName } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Detail = {
  cliente: any;
  compras_mensais: { mes: string; valor: number }[];
  compras_recentes: { data_baixa: string; valor: number; id_pedido: number }[];
};

export default function ClientDetail() {
  const { cod } = useLocalSearchParams<{ cod: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["client", cod],
    queryFn: () => apiFetch<Detail>(`/clients/${cod}`),
  });

  const header = <LogoHeader title="Cliente" onBack={() => router.back()} />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <Icon name="cloud-alert" size={40} color={colors.muted} />
          <Text style={styles.muted}>Falha ao carregar o cliente.</Text>
        </View>
      </View>
    );
  }

  const cl = data.cliente;
  const meta = Number(cl.meta || 0);
  const faturado = Number(cl.faturado || 0);
  const pct = meta > 0 ? faturado / meta : null;
  const ritmo = cl.pct_ritmo as number | null;
  const expFrac = Math.max(0, Math.min(1, Number(cl.exp_frac ?? 0)));
  const realFrac = Math.max(0, Math.min(1, pct ?? 0));
  const behind = meta > 0 && Number(cl.gap_pct ?? 0) > 0.0001;
  const barColor =
    meta <= 0
      ? colors.borderStrong
      : (ritmo ?? 0) >= 1
        ? colors.success
        : (ritmo ?? 0) >= 0.8
          ? colors.warning
          : colors.error;

  const maxMonthly = Math.max(1, ...data.compras_mensais.map((m) => m.valor));

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        {/* Cabeçalho do cliente */}
        <View style={styles.card}>
          <Text style={styles.name}>{cl.nome}</Text>
          {!!cl.razao_social && <Text style={styles.muted}>{cl.razao_social}</Text>}
          <View style={styles.chipsRow}>
            <Tag icon="map-marker-outline" text={`${cl.cidade ?? "-"} / ${cl.uf ?? ""}`} />
            <Tag icon="pound" text={String(cl.cod_cliente)} />
            <Tag
              icon={cl.status_comercial === "ATIVO" ? "check-circle-outline" : "close-circle-outline"}
              text={cl.status_comercial ?? "-"}
            />
          </View>
        </View>

        {/* Ritmo da meta */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>Ritmo da meta</Text>
              <Text style={styles.muted}>
                {behind ? "Abaixo do ritmo necessário" : meta > 0 ? "No ritmo / adiantado" : "Sem meta definida"}
              </Text>
            </View>
            <Text style={[styles.pctBig, { color: barColor }]}>{ritmo === null ? "s/ meta" : formatPct(ritmo)}</Text>
          </View>

          <View style={styles.barTrack}>
            {behind && (
              <View
                style={[
                  styles.deficit,
                  {
                    left: `${realFrac * 100}%`,
                    width: `${Math.max(0, (expFrac - realFrac) * 100)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            )}
            <View style={[styles.barFillAbs, { width: `${realFrac * 100}%`, backgroundColor: barColor }]} />
            {meta > 0 && <View style={[styles.marker, { left: `${expFrac * 100}%`, backgroundColor: colors.onSurface }]} />}
          </View>

          <View style={styles.rowBetween}>
            <Metric label="Faturado" value={formatBRL(faturado)} />
            <Metric label="Ideal hoje" value={meta > 0 ? formatBRL(cl.meta_esperada) : "—"} align="right" />
          </View>
          <View style={styles.rowBetween}>
            <Metric label="Meta do mês" value={meta > 0 ? formatBRL(meta) : "—"} />
            <Metric
              label="Meta/dia necessária"
              value={meta > 0 && cl.meta_diaria_necessaria != null ? formatBRL(cl.meta_diaria_necessaria) : "—"}
              align="right"
            />
          </View>

          {meta > 0 && (
            <View style={[styles.gapChip, { backgroundColor: behind ? "rgba(217,48,37,0.10)" : colors.brandTertiary }]}>
              <Icon name={behind ? "trending-down" : "trending-up"} size={16} color={behind ? colors.error : colors.success} />
              <Text style={[styles.gapText, { color: behind ? colors.error : colors.success }]}>
                {behind ? "Atrasado" : "Adiantado"} {formatPct(Math.abs(Number(cl.gap_pct ?? 0)))} ·{" "}
                {formatBRL(Math.abs(Number(cl.gap_valor ?? 0)))}
              </Text>
            </View>
          )}
        </View>

        {/* Histórico mensal */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Faturamento por mês</Text>
          {data.compras_mensais.length === 0 ? (
            <Text style={styles.muted}>Sem compras no período.</Text>
          ) : (
            <View style={styles.chart}>
              {data.compras_mensais.map((m) => (
                <View key={m.mes} style={styles.chartCol}>
                  <View style={styles.chartBarArea}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${(m.valor / maxMonthly) * 100}%`, backgroundColor: colors.brandPrimary },
                      ]}
                    />
                  </View>
                  <Text style={styles.chartLabel}>{m.mes.slice(5)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Financeiro / RFM */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Informações</Text>
          <InfoRow label="CNPJ/CPF" value={cl.cnpj_cpf ?? "-"} />
          <InfoRow label="Dias sem compra" value={String(cl.dias_sem_compra ?? "-")} />
          <InfoRow label="Última compra" value={cl.data_ultima_compra ?? "-"} />
          <InfoRow label="Total histórico" value={formatBRL(cl.total_compras_rs)} />
          <InfoRow label="Situação financeira" value={cl.fin_situacao ?? "-"} />
          <InfoRow label="Limite de crédito" value={formatBRL(cl.fin_limite_credito)} />
          <InfoRow label="Receita Federal" value={cl.rf_situacao ?? "-"} last />
        </View>

        {/* Compras recentes */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Compras recentes</Text>
          {data.compras_recentes.length === 0 ? (
            <Text style={styles.muted}>Nenhuma compra faturada recente.</Text>
          ) : (
            data.compras_recentes.slice(0, 12).map((p, i) => (
              <View key={`${p.id_pedido}-${i}`} style={[styles.purchaseRow, i > 0 && styles.divider]}>
                <View>
                  <Text style={styles.purchaseDate}>{p.data_baixa}</Text>
                  <Text style={styles.muted}>Pedido {p.id_pedido}</Text>
                </View>
                <Text style={styles.purchaseValue}>{formatBRL(p.valor)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Tag({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.tag}>
      <Icon name={icon} size={14} color={colors.onBrandTertiary} />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

function Metric({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  const styles = useStyles();
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start" }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.infoRow, !last && styles.divider]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    gap: 12,
  },
  name: { fontFamily: fonts.bold, fontSize: 18, color: c.onSurface },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: c.brandTertiary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontFamily: fonts.medium, fontSize: 12, color: c.onBrandTertiary },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pctBig: { fontFamily: fonts.numBold, fontSize: 18 },
  barTrack: { height: 12, borderRadius: 999, backgroundColor: c.surfaceTertiary, overflow: "hidden", position: "relative" },
  barFill: { height: 12, borderRadius: 999 },
  barFillAbs: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999 },
  deficit: { position: "absolute", top: 0, bottom: 0, opacity: 0.28 },
  marker: { position: "absolute", top: -2, bottom: -2, width: 2, opacity: 0.7 },
  gapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  gapText: { fontFamily: fonts.semibold, fontSize: 13 },
  metricLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  metricValue: { fontFamily: fonts.numBold, fontSize: 16, color: c.onSurface },
  chart: { flexDirection: "row", alignItems: "stretch", gap: 8, height: 130 },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  chartBarArea: { flex: 1, width: "70%", justifyContent: "flex-end" },
  chartBar: { width: "100%", borderRadius: 4, minHeight: 3 },
  chartLabel: { fontFamily: fonts.numMedium, fontSize: 10, color: c.muted },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  infoValue: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary, maxWidth: "60%", textAlign: "right" },
  divider: { borderTopWidth: 1, borderTopColor: c.divider },
  purchaseRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10 },
  purchaseDate: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurface },
  purchaseValue: { fontFamily: fonts.numBold, fontSize: 14, color: c.brand },
}));
