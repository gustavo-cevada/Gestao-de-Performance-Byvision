import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { ClientAnalytics, ItemVenda, Pedido } from "@/src/components/client-analytics";
import { Icon, IconName } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { usePaceTone, useLabels } from "@/src/context/config";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Detail = {
  cliente: any;
  compras_mensais: { mes: string; valor: number }[];
  pedidos: Pedido[];
  itens: ItemVenda[];
  meta_mensal: number;
  ref_month: string;
  ref_exp: number;
  dias_uteis_ref: number;
};

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "error" }> = {
  ATIVO: { label: "Ativo", tone: "success" },
  PRE_INATIVO: { label: "Pré-inativo", tone: "warning" },
  INATIVO: { label: "Inativo", tone: "error" },
};

export default function ClientDetail() {
  const { cod } = useLocalSearchParams<{ cod: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const paceTone = usePaceTone();
  const L = useLabels();
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
  const barColor = paceTone(ritmo, meta > 0);
  const saldoMes = Math.max(0, meta - faturado);

  const st = STATUS_META[cl.status_crm] ?? STATUS_META.ATIVO;
  const stColor = st.tone === "success" ? colors.success : st.tone === "warning" ? colors.warning : colors.error;
  const fantasia = (cl.nome_fantasia || cl.nome || "").trim();
  const razao = (cl.razao_social || "").trim();

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        {/* Cabeçalho do cliente */}
        <View style={styles.card}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{fantasia}</Text>
              {!!razao && razao.toUpperCase() !== fantasia.toUpperCase() && (
                <Text style={styles.razao} numberOfLines={2}>{razao}</Text>
              )}
            </View>
            <View style={[styles.statusBadge, { borderColor: stColor }]}>
              <View style={[styles.statusDot, { backgroundColor: stColor }]} />
              <Text style={[styles.statusText, { color: stColor }]}>{st.label}</Text>
            </View>
          </View>
          <Text style={styles.cnpj}>{cl.cnpj_cpf ? `CNPJ: ${cl.cnpj_cpf}` : "—"}</Text>
          <View style={styles.chipsRow}>
            <Tag icon="map-marker-outline" text={`${cl.cidade ?? "-"} / ${cl.uf ?? ""}`} />
            <Tag icon="pound" text={String(cl.cod_cliente)} />
          </View>
        </View>

        {/* Ritmo da meta */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardTitle}>{L("title_ritmo")}</Text>
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
            <Metric label={L("kpi_faturado")} value={formatBRL(faturado)} />
            <Metric label={L("kpi_previsionado")} value={meta > 0 ? formatBRL(cl.meta_esperada) : "—"} align="right" />
          </View>
          <View style={styles.rowBetween}>
            <Metric label={L("metric_meta_mes")} value={meta > 0 ? formatBRL(meta) : "—"} />
            <Metric
              label={L("metric_meta_dia")}
              value={meta > 0 && cl.meta_diaria_necessaria != null ? formatBRL(cl.meta_diaria_necessaria) : "—"}
              align="right"
            />
          </View>
          <View style={styles.rowBetween}>
            <Metric label={L("metric_saldo_mes")} value={meta > 0 ? formatBRL(saldoMes) : "—"} />
            <View style={{ flex: 1 }} />
          </View>

          {meta > 0 && (
            <View style={[styles.gapChip, { backgroundColor: colors.surfaceTertiary }]}>
              <Icon name={behind ? "trending-down" : "trending-up"} size={16} color={behind ? barColor : colors.success} />
              <Text style={[styles.gapText, { color: behind ? barColor : colors.success }]}>
                {behind ? "Atrasado" : "Adiantado"} {formatPct(Math.abs(Number(cl.gap_pct ?? 0)))} ·{" "}
                {formatBRL(Math.abs(Number(cl.gap_valor ?? 0)))}
              </Text>
            </View>
          )}
        </View>

        {/* Analytics: faturamento mês/dia, produtos, top produtos e compras recentes */}
        <ClientAnalytics
          mensais={data.compras_mensais}
          pedidos={data.pedidos}
          itens={data.itens}
          metaMensal={data.meta_mensal}
          refMonth={data.ref_month}
          refExp={data.ref_exp}
          diasUteisRef={data.dias_uteis_ref}
        />
      </ScrollView>
    </View>
  );
}

function Tag({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.tag}>
      <Icon name={icon} size={14} color={colors.muted} />
      <Text style={styles.tagText}>{text}</Text>
    </View>
  );
}

function Metric({ label, value, align = "left" }: { label: string; value: string; align?: "left" | "right" }) {
  const styles = useStyles();
  return (
    <View style={{ alignItems: align === "right" ? "flex-end" : "flex-start", flex: 1 }}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
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
  razao: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  headerTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontFamily: fonts.bold, fontSize: 12 },
  cnpj: { fontFamily: fonts.numMedium, fontSize: 12, color: c.muted },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagText: { fontFamily: fonts.medium, fontSize: 12, color: c.onSurfaceTertiary },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pctBig: { fontFamily: fonts.numBold, fontSize: 18 },
  barTrack: { height: 12, borderRadius: 3, backgroundColor: c.surfaceTertiary, overflow: "hidden", position: "relative" },
  barFill: { height: 12, borderRadius: 0 },
  barFillAbs: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 0 },
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
