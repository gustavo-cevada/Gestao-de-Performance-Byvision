import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { CityChips } from "@/src/components/city-chips";
import { ClientItem, ClientRow } from "@/src/components/client-row";
import { Icon } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { MenuSheet } from "@/src/components/menu-sheet";
import { PerformanceSummary } from "@/src/components/performance-summary";
import { PeriodFilterModal } from "@/src/components/period-filter-modal";
import { SortChips } from "@/src/components/sort-chips";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { dayLong, monthLabel, pad2 } from "@/src/lib/date";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");

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
  if (user.role === "admin") return <Redirect href="/admin" />;

  const header = (
    <LogoHeader onMenu={() => setMenuOpen(true)} title="Painel de Performance" />
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

  const refMonth = `${data.period.ref_year}-${pad2(Number(data.period.ref_month) || 1)}`;
  const filterActive = !scope.is_ref_month || !!scope.day;
  const periodLabel = scope.day ? dayLong(scope.day) : monthLabel(scope.month);

  function clearFilter() {
    setMonth(null);
    setDay(null);
  }

  const cq = clientQuery.trim().toLowerCase();
  const shownClients = cq
    ? data.clients.filter((c) => c.nome.toLowerCase().includes(cq) || c.cod_cliente.includes(cq))
    : data.clients;

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
            <Text style={styles.clearText}>Limpar</Text>
          </Pressable>
        )}
        <Pressable style={styles.iconBtn} onPress={() => sync.mutate()} testID="sync-button">
          <Icon name="refresh" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      {/* Resumo de performance: % + gráfico + KPIs */}
      <PerformanceSummary k={k} scope={scope} />

      {/* Ordenar */}
      <Text style={styles.sectionTitle}>Ordenar clientes</Text>
      <SortChips sort={sort} onChange={setSort} />

      {/* Filtro cidade */}
      <Text style={styles.sectionTitle}>Filtrar por cidade</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={shownClients}
        keyExtractor={(c) => c.cod_cliente}
        renderItem={({ item }) => (
          <ClientRow item={item} onPress={() => router.push(`/client/${item.cod_cliente}`)} />
        )}
        ListHeaderComponent={
          <>
            {listHeader}
            <CityChips cities={data.cities} selected={city} onSelect={setCity} />
            <View style={styles.clientSearch}>
              <Icon name="magnify" size={20} color={colors.muted} />
              <TextInput
                value={clientQuery}
                onChangeText={setClientQuery}
                placeholder="Localizar cliente por nome ou código…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                style={styles.clientSearchInput}
                testID="client-search"
              />
              {!!clientQuery && (
                <Pressable onPress={() => setClientQuery("")} hitSlop={8} testID="client-search-clear">
                  <Icon name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>
            <Text style={styles.clientsTitle}>{`Clientes (${shownClients.length})`}</Text>
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
      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
    gap: 14,
  },
  heroBar: { gap: 14 },
  heroPctRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroPctCol: { alignItems: "flex-start" },
  heroPctColRight: { alignItems: "flex-end" },
  heroPct: { fontFamily: fonts.numBold, fontSize: 42, lineHeight: 46 },
  heroPctLabel: { fontFamily: fonts.semibold, fontSize: 13, color: c.muted, marginTop: 0 },
  heroTrack: {
    height: 16,
    borderRadius: 4,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
    position: "relative",
  },
  heroFillLight: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 0, opacity: 0.3 },
  heroFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 0 },
  heroFalta: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  heroFaltaValue: { fontFamily: fonts.numBold, fontSize: 13, color: c.onSurface },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceSecondary,
    justifyContent: "center",
    alignItems: "center",
  },
  clientSearch: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    height: 48,
    marginTop: 10,
  },
  clientSearchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  metaBox: { alignItems: "center", gap: 4, paddingTop: 6, borderTopWidth: 1, borderTopColor: c.divider, width: "100%" },
  metaLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5, marginTop: 8 },
  metaValueBox: {
    alignSelf: "center",
    alignItems: "center",
    paddingVertical: 2,
  },
  metaValue: { fontFamily: fonts.numBold, fontSize: 28, color: c.onSurface },
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
  sortChip: { height: 36, flexShrink: 0, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  sortText: { fontFamily: fonts.semibold, fontSize: 13 },
  clientsTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 14, marginBottom: 2 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
