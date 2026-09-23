import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { CityChips } from "@/src/components/city-chips";
import { ClientItem, ClientRow } from "@/src/components/client-row";
import { Icon } from "@/src/components/icon";
import { KpiCard } from "@/src/components/kpi-card";
import { LogoHeader } from "@/src/components/logo-header";
import { PeriodFilterModal } from "@/src/components/period-filter-modal";
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
  period: { ref_year?: number; ref_month?: number };
  scope: Scope;
  months: string[];
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
  const [periodOpen, setPeriodOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-dashboard", cod, city, month, day],
    queryFn: () => {
      const p = new URLSearchParams({ city, vendedor: cod });
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

  const k = data.kpi;
  const scope = data.scope;
  const dayMode = scope.day_mode;
  const gapBehind = k.gap_valor > 0;
  const gapTone = gapBehind ? "error" : "success";
  const refMonth = `${data.period.ref_year}-${pad2(Number(data.period.ref_month) || 1)}`;
  const filterActive = !scope.is_ref_month || !!scope.day;
  const periodLabel = scope.day ? dayLong(scope.day) : monthLabel(scope.month);

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

      <View style={styles.hero}>
        <HeroBar
          real={k.pct_atingimento_realizado}
          prev={k.pct_atingimento_provisionado}
          meta={k.meta_vendas}
          realizado={k.vendas_realizadas}
        />
        <View style={styles.metaBox}>
          <Text style={styles.metaLabel}>{dayMode ? "META DO DIA" : "META DE VENDAS DO MÊS"}</Text>
          <Text style={styles.metaValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {formatBRL(k.meta_vendas)}
          </Text>
          {!dayMode && (
            <Text style={styles.metaHint}>
              {`${scope.dias_uteis_decorridos} de ${scope.total_dias_uteis} dias úteis · ${scope.dias_uteis_restantes} restantes`}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.grid}>
        <KpiCard label={dayMode ? "Vendas do dia" : "Faturado"} value={formatBRL(k.vendas_realizadas)} icon="cash-check" testID="kpi-realizada" />
        <KpiCard label={dayMode ? "Previsionado do dia" : "Previsionado"} value={formatBRL(k.venda_provisionada)} icon="chart-timeline-variant" testID="kpi-provisionada" />
      </View>
      <View style={styles.grid}>
        <KpiCard
          label={gapBehind ? "Gap (falta) R$" : "Gap (à frente) R$"}
          value={formatBRL(Math.abs(k.gap_valor))}
          icon={gapBehind ? "trending-down" : "trending-up"}
          tone={gapTone}
          testID="kpi-gap-valor"
        />
        <KpiCard label="Gap (%)" value={formatPct(Math.abs(k.gap_pct))} icon="percent-outline" tone={gapTone} testID="kpi-gap-pct" />
      </View>

      <Text style={styles.sectionTitle}>Filtrar por cidade</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={data.clients}
        keyExtractor={(c) => c.cod_cliente}
        renderItem={({ item }) => <ClientRow item={item} onPress={() => router.push(`/client/${item.cod_cliente}`)} />}
        ListHeaderComponent={
          <>
            {listHeader}
            <CityChips cities={data.cities} selected={city} onSelect={setCity} />
            <Text style={styles.clientsTitle}>{`Clientes (${data.clients.length})`}</Text>
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

function HeroBar({ real, prev, meta, realizado }: { real: number; prev: number; meta: number; realizado: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const ritmo = prev > 0 ? real / prev : real >= 1 ? 1 : 0;
  const tone = ritmo >= 1 ? colors.success : ritmo >= 0.76 ? colors.warning : colors.error;
  const faturadoW = Math.max(0, Math.min(1, real)) * 100;
  const prevW = Math.max(0, Math.min(1, prev)) * 100;
  const falta = Math.max(0, meta - realizado);
  return (
    <View style={styles.heroBar}>
      <View style={styles.heroPctRow}>
        <View style={styles.heroPctCol}>
          <Text style={[styles.heroPct, { color: tone }]}>{`${Math.round(real * 100)}%`}</Text>
          <Text style={styles.heroPctLabel}>Faturado</Text>
        </View>
        <View style={styles.heroPctColRight}>
          <Text style={[styles.heroPct, { color: colors.muted }]}>{`${Math.round(prev * 100)}%`}</Text>
          <Text style={styles.heroPctLabel}>Previsionado</Text>
        </View>
      </View>
      <View style={styles.heroTrack}>
        <View style={[styles.heroFillLight, { width: `${prevW}%`, backgroundColor: tone }]} />
        <View style={[styles.heroFill, { width: `${faturadoW}%`, backgroundColor: tone }]} />
      </View>
      <Text style={styles.heroFalta}>
        Falta <Text style={styles.heroFaltaValue}>{formatBRL(falta)}</Text> para 100% da meta
      </Text>
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

  hero: { backgroundColor: c.surfaceSecondary, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 20, gap: 14 },
  heroBar: { gap: 14 },
  heroPctRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroPctCol: { alignItems: "flex-start" },
  heroPctColRight: { alignItems: "flex-end" },
  heroPct: { fontFamily: fonts.numBold, fontSize: 40, lineHeight: 44 },
  heroPctLabel: { fontFamily: fonts.semibold, fontSize: 13, color: c.muted },
  heroTrack: { height: 16, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden", position: "relative" },
  heroFillLight: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.3 },
  heroFill: { position: "absolute", left: 0, top: 0, bottom: 0 },
  heroFalta: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  heroFaltaValue: { fontFamily: fonts.numBold, fontSize: 13, color: c.onSurface },

  metaBox: { alignItems: "center", gap: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: c.divider, width: "100%" },
  metaLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5 },
  metaValue: { fontFamily: fonts.numBold, fontSize: 26, color: c.onSurface },
  metaHint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },

  grid: { flexDirection: "row", gap: 12 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 4 },
  clientsTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 14, marginBottom: 2 },
  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
