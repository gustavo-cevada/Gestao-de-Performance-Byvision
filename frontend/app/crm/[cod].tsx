import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { BarChart } from "@/src/components/bar-chart";
import { Icon } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { formatBRL, formatDateBR } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "error" }> = {
  ATIVO: { label: "Ativo", tone: "success" },
  PRE_INATIVO: { label: "Pré-inativo", tone: "warning" },
  INATIVO: { label: "Inativo", tone: "error" },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function CrmClientProfile() {
  const { cod } = useLocalSearchParams<{ cod: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["client", cod],
    queryFn: () => apiFetch<any>(`/clients/${cod}`),
  });

  const header = (
    <LogoHeader
      title="Perfil do Cliente"
      onBack={() => router.back()}
      actions={[{ icon: "refresh", onPress: () => refetch(), testID: "profile-refresh" }]}
    />
  );

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
  const st = STATUS_META[cl.status_crm] ?? STATUS_META.ATIVO;
  const stColor = st.tone === "success" ? colors.success : st.tone === "warning" ? colors.warning : colors.error;

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        {/* Cabeçalho do perfil */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(cl.nome)}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {cl.nome}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: stColor }]}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{st.label}</Text>
              </View>
            </View>
            <View style={styles.locRow}>
              <Icon name="map-marker-outline" size={15} color={colors.muted} />
              <Text style={styles.loc}>{`${cl.cidade ?? "-"} - ${cl.uf ?? ""}`}</Text>
            </View>
            <Text style={styles.cod}>{`Código #${cl.cod_cliente}`}</Text>
          </View>
        </View>

        {/* Métricas */}
        <View style={styles.grid}>
          <StatCard label="Última compra" value={`${cl.dias_sem_compra ?? "—"} dias`} />
          <StatCard label="Ticket médio" value={formatBRL(cl.ticket_medio)} />
        </View>
        <View style={styles.grid}>
          <StatCard label="Faturamento acumulado" value={formatBRL(cl.faturamento_acumulado)} />
          <StatCard label="Faturamento últimos 12 meses" value={formatBRL(cl.faturamento_12m)} />
        </View>

        {/* Histórico de compras */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Histórico de compras</Text>
          <BarChart data={data.compras_mensais} />
        </View>

        {/* Últimos pedidos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Últimos pedidos</Text>
          <View style={styles.pedHead}>
            <Text style={[styles.pedH, { flex: 1 }]}>Data</Text>
            <Text style={[styles.pedH, { flex: 1 }]}>Pedido</Text>
            <Text style={[styles.pedH, { width: 100, textAlign: "right" }]}>Valor</Text>
          </View>
          {data.compras_recentes.length === 0 ? (
            <Text style={styles.muted}>Nenhum pedido faturado recente.</Text>
          ) : (
            data.compras_recentes.slice(0, 15).map((p: any, i: number) => (
              <View key={`${p.id_pedido}-${i}`} style={styles.pedRow}>
                <Text style={[styles.pedCell, { flex: 1 }]}>{formatDateBR(p.data_baixa)}</Text>
                <Text style={[styles.pedCell, { flex: 1 }]}>{p.id_pedido}</Text>
                <Text style={[styles.pedValue, { width: 100 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {formatBRL(p.valor)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
  },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: c.brandPrimary, justifyContent: "center", alignItems: "center" },
  avatarText: { fontFamily: fonts.bold, fontSize: 20, color: c.onBrandPrimary },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 17, color: c.onSurface },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" },
  statusText: { fontFamily: fonts.semibold, fontSize: 11, color: "#ffffff" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  loc: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary },
  cod: { fontFamily: fonts.numMedium, fontSize: 11, color: c.muted },

  grid: { flexDirection: "row", gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 6,
    minHeight: 76,
    justifyContent: "space-between",
  },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: c.muted },
  statValue: { fontFamily: fonts.numBold, fontSize: 18, color: c.onSurface },

  card: { backgroundColor: c.surfaceSecondary, borderRadius: 16, borderWidth: 1, borderColor: c.border, padding: 16, gap: 12 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  chart: { flexDirection: "row", alignItems: "stretch", gap: 6, height: 140 },
  chartCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  chartBarArea: { flex: 1, width: "68%", justifyContent: "flex-end" },
  chartBar: { width: "100%", borderRadius: 4, minHeight: 3 },
  chartLabel: { fontFamily: fonts.numMedium, fontSize: 10, color: c.muted },

  pedHead: { flexDirection: "row", alignItems: "center", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
  pedH: { fontFamily: fonts.semibold, fontSize: 11, color: c.muted },
  pedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.divider },
  pedCell: { fontFamily: fonts.medium, fontSize: 12, color: c.onSurfaceSecondary },
  pedValue: { fontFamily: fonts.numBold, fontSize: 13, color: c.brand, textAlign: "right" },
}));
