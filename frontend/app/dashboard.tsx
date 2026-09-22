import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
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
import { PeriodFilterModal } from "@/src/components/period-filter-modal";
import { ProgressRing } from "@/src/components/progress-ring";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { dayLong, monthLabel, pad2 } from "@/src/lib/date";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Scope = {
  month: string;
  day: string | null;
  day_mode: boolean;
  total_dias_uteis: number;
  dias_uteis_decorridos: number;
  dias_uteis_restantes: number;
  is_ref_month: boolean;
};

type Dashboard = {
  period: { ref_year?: number; ref_month?: number; last_sync?: string };
  scope: Scope;
  months: string[];
  sort: string;
  kpi: {
    meta_vendas: number;
    vendas_realizadas: number;
    venda_provisionada: number;
    gap_valor: number;
    pct_atingimento_provisionado: number;
    pct_atingimento_realizado: number;
    gap_pct: number;
    meta_do_dia: number;
  };
  cities: string[];
  total_clientes: number;
  clients: ClientItem[];
};

const SORTS = [
  { key: "atingimento_desc", label: "Maior atingimento" },
  { key: "atingimento_asc", label: "Menor atingimento" },
  { key: "faturado_desc", label: "Mais vendido" },
  { key: "faturado_asc", label: "Menos vendido" },
];

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [city, setCity] = useState("TODAS");
  const [month, setMonth] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [sort, setSort] = useState("atingimento_desc");
  const [periodOpen, setPeriodOpen] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["dashboard", city, month, day, sort],
    queryFn: () => {
      const p = new URLSearchParams({ city, sort });
      if (month) p.set("month", month);
      if (day) p.set("day", day);
      return apiFetch<Dashboard>(`/dashboard?${p.toString()}`);
    },
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
        { icon: "calendar-range" as const, onPress: () => setPeriodOpen(true), testID: "period-button" },
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
  const scope = data.scope;
  const dayMode = scope.day_mode;
  const gapBehind = k.gap_valor > 0;
  const gapTone = gapBehind ? "error" : "success";

  const refMonth = `${data.period.ref_year}-${pad2(Number(data.period.ref_month) || 1)}`;
  const filterActive = !scope.is_ref_month || !!scope.day;
  const periodLabel = scope.day ? dayLong(scope.day) : monthLabel(scope.month);

  function clearFilter() {
    setMonth(null);
    setDay(null);
  }

  const listHeader = (
    <View style={styles.listHeader}>
      {sync.isPending && (
        <View style={styles.syncBanner} testID="sync-banner">
          <ActivityIndicator size="small" color={colors.onBrandTertiary} />
          <Text style={styles.syncBannerText}>Atualizando vendas em tempo real…</Text>
        </View>
      )}

      {/* Filtro de período */}
      <View style={styles.periodRow}>
        <Pressable style={styles.periodPill} onPress={() => setPeriodOpen(true)} testID="period-pill">
          <Icon name="calendar-range" size={18} color={colors.brandPrimary} />
          <Text style={styles.periodText} numberOfLines={1}>
            {periodLabel}
          </Text>
          <Icon name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
        {filterActive && (
          <Pressable style={styles.clearBtn} onPress={clearFilter} testID="clear-filter-button">
            <Icon name="close-circle" size={16} color={colors.onError} />
            <Text style={styles.clearText}>Limpar filtro</Text>
          </Pressable>
        )}
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        <ProgressRing
          realizado={k.pct_atingimento_realizado}
          provisionado={k.pct_atingimento_provisionado}
        />
        <View style={styles.legend}>
          <LegendDot color={colorForReal(k, colors)} label="Realizado" value={formatPct(k.pct_atingimento_realizado)} />
          <LegendDot color={colors.info} label={dayMode ? "Alvo dia" : "Previsto"} value={formatPct(k.pct_atingimento_provisionado)} />
        </View>
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>{dayMode ? "META DO DIA" : "META DE VENDAS DO MÊS"}</Text>
          <Text style={styles.metaValue}>{formatBRL(k.meta_vendas)}</Text>
          {dayMode ? (
            <Text style={styles.metaHint}>{scope.day ? dayLong(scope.day) : ""}</Text>
          ) : (
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

      {/* KPI grid */}
      <View style={styles.grid}>
        <KpiCard label={dayMode ? "Vendas do dia" : "Vendas realizadas"} value={formatBRL(k.vendas_realizadas)} icon="cash-check" tone="success" testID="kpi-realizada" />
        <KpiCard label={dayMode ? "Provisionado do dia" : "Venda provisionada"} value={formatBRL(k.venda_provisionada)} icon="chart-timeline-variant" testID="kpi-provisionada" />
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

      {/* Ordenar */}
      <Text style={styles.sectionTitle}>Ordenar clientes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              style={[styles.sortChip, { backgroundColor: active ? colors.surfaceInverse : colors.surfaceTertiary }]}
              testID={`sort-${s.key}`}
            >
              <Text style={[styles.sortText, { color: active ? colors.onSurfaceInverse : colors.onSurfaceTertiary }]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Filtro cidade */}
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
            <Text style={styles.centerText}>Nenhum cliente neste filtro.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />
        }
        testID="dashboard-client-list"
      />

      <PeriodFilterModal
        visible={periodOpen}
        months={data.months}
        selectedMonth={scope.month}
        selectedDay={scope.day}
        refMonth={refMonth}
        onApply={(m, d) => {
          setMonth(m === refMonth ? null : m);
          setDay(d);
          setPeriodOpen(false);
        }}
        onClose={() => setPeriodOpen(false)}
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

  periodRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  periodPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  periodText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.error,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
  },
  clearText: { fontFamily: fonts.bold, fontSize: 13, color: c.onError },

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
  metaBox: { alignItems: "center", gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.divider, width: "100%" },
  metaLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5, marginTop: 8 },
  metaValue: { fontFamily: fonts.numBold, fontSize: 26, color: c.brand },
  metaHint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  metaDayChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.brandTertiary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  metaDayText: { fontFamily: fonts.regular, fontSize: 12, color: c.onBrandTertiary },
  metaDayValue: { fontFamily: fonts.numBold, fontSize: 12, color: c.onBrandTertiary },

  grid: { flexDirection: "row", gap: 12 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 4 },
  sortRow: { gap: 8, paddingVertical: 2 },
  sortChip: { height: 36, flexShrink: 0, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", alignItems: "center" },
  sortText: { fontFamily: fonts.semibold, fontSize: 13 },
  clientsTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 14, marginBottom: 2 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
