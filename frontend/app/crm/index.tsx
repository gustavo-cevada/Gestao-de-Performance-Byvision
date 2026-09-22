import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { Icon, IconName } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { SelectDropdown } from "@/src/components/select-dropdown";
import { formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type CrmClient = {
  cod_cliente: string;
  nome: string;
  cnpj_digits: string;
  cidade: string;
  uf: string | null;
  dias_sem_compra: number | null;
  status: "ATIVO" | "PRE_INATIVO" | "INATIVO";
  faturamento_12m: number;
  rank: number | null;
  rank_delta: number | null;
  movimento: string;
};

type CrmResp = {
  summary: {
    total: number;
    ativos: number;
    pre_inativos: number;
    inativos: number;
    pct_ativos: number;
    pct_pre_inativos: number;
    pct_inativos: number;
  };
  cities: string[];
  clients: CrmClient[];
};

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "error" }> = {
  ATIVO: { label: "Ativo", tone: "success" },
  PRE_INATIVO: { label: "Pré-inativo", tone: "warning" },
  INATIVO: { label: "Inativo", tone: "error" },
};

function onlyDigits(s: string) {
  return s.replace(/\D/g, "");
}

export default function CrmScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [cidade, setCidade] = useState("TODAS");
  const [status, setStatus] = useState("TODOS");
  const [cod, setCod] = useState("TODOS");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["crm"],
    queryFn: () => apiFetch<CrmResp>("/crm"),
  });

  const cityOptions = useMemo(
    () => [{ label: "Todas as cidades", value: "TODAS" }, ...(data?.cities ?? []).map((c) => ({ label: c, value: c }))],
    [data],
  );
  const statusOptions = [
    { label: "Todos os status", value: "TODOS" },
    { label: "Ativo", value: "ATIVO" },
    { label: "Pré-inativo", value: "PRE_INATIVO" },
    { label: "Inativo", value: "INATIVO" },
  ];
  const clientOptions = useMemo(
    () => [
      { label: "Todos os clientes", value: "TODOS" },
      ...(data?.clients ?? []).map((c) => ({ label: `#${c.cod_cliente} · ${c.nome}`, value: c.cod_cliente })),
    ],
    [data],
  );

  const filtered = useMemo(() => {
    const list = data?.clients ?? [];
    const term = search.trim().toLowerCase();
    const digits = onlyDigits(search);
    return list.filter((c) => {
      if (cidade !== "TODAS" && c.cidade !== cidade) return false;
      if (status !== "TODOS" && c.status !== status) return false;
      if (cod !== "TODOS" && c.cod_cliente !== cod) return false;
      if (term) {
        const byName = c.nome.toLowerCase().includes(term);
        const byCity = c.cidade.toLowerCase().includes(term);
        const byCnpj = digits.length >= 2 && c.cnpj_digits.includes(digits);
        const byCod = c.cod_cliente.includes(term);
        if (!byName && !byCity && !byCnpj && !byCod) return false;
      }
      return true;
    });
  }, [data, cidade, status, cod, search]);

  const header = (
    <LogoHeader title="CRM & Ranking" onBack={() => router.back()} />
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
          <Text style={styles.muted}>Falha ao carregar o CRM.</Text>
          <Pressable style={styles.retryBtn} onPress={() => refetch()} testID="crm-retry">
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const s = data.summary;

  const listHeader = (
    <View style={{ gap: 14 }}>
      {/* Filtros */}
      <View style={styles.filtersRow}>
        <SelectDropdown label="Cidade" value={cidade} options={cityOptions} onChange={setCidade} testID="filter-cidade" />
        <SelectDropdown label="Cliente" value={cod} options={clientOptions} onChange={setCod} testID="filter-cliente" />
        <SelectDropdown label="Status" value={status} options={statusOptions} onChange={setStatus} testID="filter-status" />
      </View>

      {/* Busca */}
      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cliente, cidade ou CNPJ…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={styles.searchInput}
          testID="crm-search"
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")} hitSlop={8} testID="crm-search-clear">
            <Icon name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Resumo */}
      <View style={styles.summaryGrid}>
        <SummaryCard label="Total" value={String(s.total)} dot={colors.info} testID="summary-total" />
        <SummaryCard label="Ativos" value={String(s.ativos)} sub={formatPct(s.pct_ativos)} dot={colors.success} testID="summary-ativos" />
        <SummaryCard label="Pré-inativos" value={String(s.pre_inativos)} sub={formatPct(s.pct_pre_inativos)} dot={colors.warning} testID="summary-pre" />
        <SummaryCard label="Inativos" value={String(s.inativos)} sub={formatPct(s.pct_inativos)} dot={colors.error} testID="summary-inativos" />
      </View>

      {/* Cabeçalho da tabela */}
      <View style={styles.tableHead}>
        <Text style={[styles.thCliente, styles.thText]}>Cliente</Text>
        <Text style={[styles.thCidade, styles.thText]}>Cidade</Text>
        <Text style={[styles.thDias, styles.thText]}>dias s/{"\n"}compra</Text>
        <Text style={[styles.thStatus, styles.thText]}>status</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={filtered}
        keyExtractor={(c) => c.cod_cliente}
        ListHeaderComponent={listHeader}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Row item={item} onPress={() => router.push(`/crm/${item.cod_cliente}`)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon name="account-search-outline" size={34} color={colors.muted} />
            <Text style={styles.muted}>Nenhum cliente encontrado.</Text>
          </View>
        }
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        testID="crm-list"
      />
    </View>
  );
}

function movimentoIcon(mov: string): { name: IconName; tone: "success" | "error" | "brand" } | null {
  if (mov === "subiu") return { name: "arrow-up-bold", tone: "success" };
  if (mov === "desceu") return { name: "arrow-down-bold", tone: "error" };
  if (mov === "sumiu") return { name: "alert-circle-outline", tone: "error" };
  if (mov === "novo") return { name: "star-four-points", tone: "brand" };
  return null;
}

function Row({ item, onPress }: { item: CrmClient; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const st = STATUS_META[item.status];
  const stColor = st.tone === "success" ? colors.success : st.tone === "warning" ? colors.warning : colors.error;
  const mov = movimentoIcon(item.movimento);
  const movColor = mov?.tone === "success" ? colors.success : mov?.tone === "error" ? colors.error : colors.brand;

  return (
    <Pressable style={styles.row} onPress={onPress} testID={`crm-row-${item.cod_cliente}`}>
      <View style={styles.tdCliente}>
        <Text style={styles.name} numberOfLines={1}>
          {item.nome}
        </Text>
        <View style={styles.subRow}>
          <Text style={styles.sub}>{`#${item.cod_cliente}`}</Text>
          {item.rank != null && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{`#${item.rank}`}</Text>
              {mov && <Icon name={mov.name} size={12} color={movColor} />}
              {item.rank_delta != null && item.rank_delta !== 0 && (
                <Text style={[styles.rankDelta, { color: movColor }]}>{Math.abs(item.rank_delta)}</Text>
              )}
            </View>
          )}
        </View>
      </View>
      <Text style={[styles.tdCidade, styles.cityText]} numberOfLines={2}>
        {item.cidade}
      </Text>
      <Text style={[styles.tdDias, styles.diasText]}>{item.dias_sem_compra ?? "—"}</Text>
      <View style={styles.tdStatus}>
        <View style={[styles.statusBadge, { backgroundColor: stColor }]}>
          <Text style={styles.statusText}>{st.label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  dot,
  testID,
}: {
  label: string;
  value: string;
  sub?: string;
  dot: string;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.summaryCard} testID={testID}>
      <View style={styles.summaryTop}>
        <View style={[styles.summaryDot, { backgroundColor: dot }]} />
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
      <Text style={styles.summaryValue}>{value}</Text>
      {!!sub && <Text style={styles.summarySub}>{sub}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, textAlign: "center" },
  retryBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 14 },

  filtersRow: { flexDirection: "row", gap: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    height: 50,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.onSurface,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },

  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  summaryCard: {
    width: "47.8%",
    flexGrow: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 8,
  },
  summaryTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  summaryDot: { width: 9, height: 9, borderRadius: 5 },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary },
  summaryValue: { fontFamily: fonts.numBold, fontSize: 24, color: c.onSurface },
  summarySub: { fontFamily: fonts.numMedium, fontSize: 12, color: c.muted },

  tableHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginTop: 4,
  },
  thText: { fontFamily: fonts.semibold, fontSize: 11, color: c.muted },
  thCliente: { flex: 1.7 },
  thCidade: { flex: 1.1 },
  thDias: { width: 46, textAlign: "center" },
  thStatus: { width: 78, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  tdCliente: { flex: 1.7, paddingRight: 6, gap: 3 },
  name: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  subRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sub: { fontFamily: fonts.numMedium, fontSize: 11, color: c.muted },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rankText: { fontFamily: fonts.numBold, fontSize: 10, color: c.onSurfaceTertiary },
  rankDelta: { fontFamily: fonts.numBold, fontSize: 10 },
  tdCidade: { flex: 1.1, paddingRight: 6 },
  cityText: { fontFamily: fonts.regular, fontSize: 12, color: c.onSurfaceSecondary },
  tdDias: { width: 46, textAlign: "center" },
  diasText: { fontFamily: fonts.numMedium, fontSize: 13, color: c.onSurface },
  tdStatus: { width: 78, alignItems: "center" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontFamily: fonts.semibold, fontSize: 10.5, color: "#ffffff" },

  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
