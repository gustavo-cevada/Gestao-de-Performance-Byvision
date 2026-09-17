import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { CityChips } from "@/src/components/city-chips";
import { ClientItem, ClientRow } from "@/src/components/client-row";
import { Icon } from "@/src/components/icon";
import { KpiCard } from "@/src/components/kpi-card";
import { LogoHeader } from "@/src/components/logo-header";
import { ProgressRing } from "@/src/components/progress-ring";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Dashboard = {
  period: { as_of?: string; total_dias_uteis?: number; dias_uteis_decorridos?: number; last_sync?: string };
  kpi: {
    meta_vendas: number;
    vendas_realizadas: number;
    venda_provisionada: number;
    gap_valor: number;
    pct_atingimento_provisionado: number;
    pct_atingimento_realizado: number;
    gap_pct: number;
  };
  cities: string[];
  selected_city: string;
  total_clientes: number;
  clients: ClientItem[];
};

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [city, setCity] = useState("TODAS");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", city],
    queryFn: () => apiFetch<Dashboard>(`/dashboard?city=${encodeURIComponent(city)}`),
    enabled: !!user,
  });

  const sync = useMutation({
    mutationFn: () => apiFetch("/sync", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast("Vendas atualizadas em tempo real", "success");
    },
    onError: () => toast("Falha ao atualizar dados", "error"),
  });

  if (!user) return <Redirect href="/login" />;

  const header = (
    <LogoHeader
      title="Performance"
      subtitle={user.nome?.split(" ")[0] ? `Olá, ${user.nome.split(" ")[0]}` : "Painel de vendas"}
      actions={[
        ...(sync.isPending
          ? []
          : [{ icon: "refresh" as const, onPress: () => sync.mutate(), testID: "sync-button" }]),
        ...(user.role === "admin"
          ? [{ icon: "tune-variant" as const, onPress: () => router.push("/admin"), testID: "admin-button" }]
          : []),
        { icon: "cog-outline" as const, onPress: () => router.push("/settings"), testID: "settings-button" },
      ]}
    />
  );

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.centerText}>Carregando desempenho…</Text>
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
          <Text style={styles.centerText}>Não foi possível carregar os dados.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()} testID="retry-button">
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const k = data.kpi;
  const gapBehind = k.gap_valor > 0; // positivo = atrás do previsto
  const gapTone = gapBehind ? "error" : "success";

  const listHeader = (
    <View style={styles.listHeader}>
      {sync.isPending && (
        <View style={styles.syncBanner} testID="sync-banner">
          <ActivityIndicator size="small" color={colors.onBrandTertiary} />
          <Text style={styles.syncBannerText}>Atualizando vendas em tempo real…</Text>
        </View>
      )}

      {/* Hero */}
      <View style={styles.hero}>
        <ProgressRing
          realizado={k.pct_atingimento_realizado}
          provisionado={k.pct_atingimento_provisionado}
        />
        <View style={styles.legend}>
          <LegendDot color={data ? colorForReal(k, colors) : colors.brandPrimary} label="Realizado" value={formatPct(k.pct_atingimento_realizado)} />
          <LegendDot color={colors.info} label="Previsto" value={formatPct(k.pct_atingimento_provisionado)} />
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>META DE VENDAS DO MÊS</Text>
          <Text style={styles.metaValue}>{formatBRL(k.meta_vendas)}</Text>
          <Text style={styles.metaHint}>
            {`${data.period.dias_uteis_decorridos ?? 0} de ${data.period.total_dias_uteis ?? 0} dias úteis`}
          </Text>
        </View>
      </View>

      {/* KPI grid */}
      <View style={styles.grid}>
        <KpiCard label="Vendas realizadas" value={formatBRL(k.vendas_realizadas)} icon="cash-check" tone="success" testID="kpi-realizada" />
        <KpiCard label="Venda provisionada" value={formatBRL(k.venda_provisionada)} icon="chart-timeline-variant" testID="kpi-provisionada" />
      </View>
      <View style={styles.grid}>
        <KpiCard
          label={gapBehind ? "Gap (falta) R$" : "Gap (à frente) R$"}
          value={formatBRL(Math.abs(k.gap_valor))}
          icon={gapBehind ? "trending-down" : "trending-up"}
          tone={gapTone}
          testID="kpi-gap-valor"
        />
        <KpiCard
          label="Gap (%)"
          value={formatPct(Math.abs(k.gap_pct))}
          icon="percent-outline"
          tone={gapTone}
          testID="kpi-gap-pct"
        />
      </View>

      {/* Filtro */}
      <Text style={styles.sectionTitle}>Filtrar por cidade</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={data.clients}
        keyExtractor={(c) => c.cod_cliente}
        renderItem={({ item }) => (
          <ClientRow item={item} onPress={() => router.push(`/client/${item.cod_cliente}`)} />
        )}
        ListHeaderComponent={
          <>
            {listHeader}
            <CityChips cities={data.cities} selected={city} onSelect={setCity} />
            <Text style={styles.clientsTitle}>{`Clientes (${data.total_clientes})`}</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="account-search-outline" size={36} color={colors.muted} />
            <Text style={styles.centerText}>Nenhum cliente nesta cidade.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
        }
        testID="dashboard-client-list"
      />
    </View>
  );
}

function colorForReal(k: Dashboard["kpi"], colors: any) {
  return k.pct_atingimento_realizado >= k.pct_atingimento_provisionado
    ? colors.success
    : k.pct_atingimento_realizado >= k.pct_atingimento_provisionado * 0.75
      ? colors.warning
      : colors.error;
}

function LegendDot({ color, label, value }: { color: string; label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { fontFamily: fonts.medium, fontSize: 14, color: c.muted, textAlign: "center" },
  retryBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 14 },

  listHeader: { gap: 12 },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.brandTertiary,
    borderRadius: 10,
    padding: 12,
  },
  syncBannerText: { fontFamily: fonts.medium, fontSize: 13, color: c.onBrandTertiary },

  hero: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 20,
    alignItems: "center",
    gap: 14,
  },
  legend: { flexDirection: "row", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  legendValue: { fontFamily: fonts.numBold, fontSize: 13, color: c.onSurface },
  metaBox: { alignItems: "center", gap: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.divider, width: "100%" },
  metaLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5, marginTop: 8 },
  metaValue: { fontFamily: fonts.numBold, fontSize: 26, color: c.brand },
  metaHint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },

  grid: { flexDirection: "row", gap: 12 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 4 },
  clientsTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 14, marginBottom: 2 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
