import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { CityChips } from "@/src/components/city-chips";
import { ClientItem, ClientRow } from "@/src/components/client-row";
import { Icon } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { Kpi, PerformanceSummary, ScopeInfo } from "@/src/components/performance-summary";
import { PeriodFilterModal } from "@/src/components/period-filter-modal";
import { SortChips } from "@/src/components/sort-chips";
import { useAuth } from "@/src/context/auth";
import { dayLong, monthLabel, pad2 } from "@/src/lib/date";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Dashboard = {
  period: { ref_year?: number; ref_month?: number };
  scope: ScopeInfo & { month: string; is_ref_month: boolean };
  months: string[];
  kpi: Kpi;
  cities: string[];
  total_clientes: number;
  clients: ClientItem[];
};

export default function VendedorDetail() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ cod: string; nome?: string }>();
  const cod = String(params.cod);

  const [city, setCity] = useState("TODAS");
  const [month, setMonth] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [sort, setSort] = useState("atingimento_desc");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard", cod, city, month, day, sort],
    queryFn: () => {
      const p = new URLSearchParams({ city, sort, vendedor: cod });
      if (month) p.set("month", month);
      if (day) p.set("day", day);
      return apiFetch<Dashboard>(`/dashboard?${p.toString()}`);
    },
    enabled: user?.role === "admin",
  });

  if (user?.role !== "admin") return <Redirect href="/dashboard" />;

  const title = params.nome || `Vendedor #${cod}`;
  const header = <LogoHeader title={title} subtitle={`#${cod}`} onBack={() => router.back()} />;

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
          <Text style={styles.centerText}>Não foi possível carregar os dados.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const scope = data.scope;
  const refMonth = `${data.period.ref_year}-${pad2(Number(data.period.ref_month) || 1)}`;
  const filterActive = !scope.is_ref_month || !!scope.day;
  const periodLabel = scope.day ? dayLong(scope.day) : monthLabel(scope.month);

  const cq = clientQuery.trim().toLowerCase();
  const shownClients = cq
    ? data.clients.filter((c) => c.nome.toLowerCase().includes(cq) || c.cod_cliente.includes(cq))
    : data.clients;

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.periodRow}>
        <Pressable style={styles.periodPill} onPress={() => setPeriodOpen(true)} testID="period-pill">
          <Icon name="calendar-range" size={18} color={colors.brandPrimary} />
          <Text style={styles.periodText} numberOfLines={1}>
            {periodLabel}
          </Text>
          <Icon name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
        {filterActive && (
          <Pressable
            style={styles.clearBtn}
            onPress={() => {
              setMonth(null);
              setDay(null);
            }}
            testID="clear-filter-button"
          >
            <Icon name="close-circle" size={16} color={colors.onError} />
            <Text style={styles.clearText}>Limpar</Text>
          </Pressable>
        )}
      </View>

      <PerformanceSummary k={data.kpi} scope={scope} />

      <Text style={styles.sectionTitle}>Ordenar clientes</Text>
      <SortChips sort={sort} onChange={setSort} />

      <Text style={styles.sectionTitle}>Filtrar por cidade</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={shownClients}
        keyExtractor={(c) => c.cod_cliente}
        renderItem={({ item }) => <ClientRow item={item} onPress={() => router.push(`/client/${item.cod_cliente}`)} />}
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
        testID="admin-vendedor-dashboard"
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

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { fontFamily: fonts.medium, fontSize: 14, color: c.muted, textAlign: "center" },
  retryBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 14 },

  listHeader: { gap: 12 },
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

  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 4 },
  clientsTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 14, marginBottom: 2 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
