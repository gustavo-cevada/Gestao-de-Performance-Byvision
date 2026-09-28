import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { Icon, IconName } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { SelectDropdown } from "@/src/components/select-dropdown";
import { formatBRL, formatPct } from "@/src/lib/format";
import { buildCsv, exportCsv } from "@/src/lib/export-csv";
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

type CrmResp = { cities: string[]; clients: CrmClient[] };

const STATUS_META: Record<string, { label: string; tone: "success" | "warning" | "error" }> = {
  ATIVO: { label: "Ativo", tone: "success" },
  PRE_INATIVO: { label: "Pré-inativo", tone: "warning" },
  INATIVO: { label: "Inativo", tone: "error" },
};

const MOVIMENTO_LABEL: Record<string, string> = {
  subiu: "Subiu",
  desceu: "Desceu",
  sumiu: "Sumiu",
  novo: "Novo",
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

  const filteredBase = useMemo(() => {
    const list = data?.clients ?? [];
    const term = search.trim().toLowerCase();
    const digits = onlyDigits(search);
    return list.filter((c) => {
      if (cidade !== "TODAS" && c.cidade !== cidade) return false;
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
  }, [data, cidade, cod, search]);

  const filtered = useMemo(
    () => (status === "TODOS" ? filteredBase : filteredBase.filter((c) => c.status === status)),
    [filteredBase, status],
  );

  // resumo ignora o filtro de status para manter os quadros clicáveis e informativos
  const summary = useMemo(() => {
    const total = filteredBase.length;
    const ativos = filteredBase.filter((c) => c.status === "ATIVO").length;
    const pre = filteredBase.filter((c) => c.status === "PRE_INATIVO").length;
    const inativos = filteredBase.filter((c) => c.status === "INATIVO").length;
    const pct = (n: number) => (total ? n / total : 0);
    return { total, ativos, pre, inativos, pctA: pct(ativos), pctP: pct(pre), pctI: pct(inativos) };
  }, [filteredBase]);

  const toggleStatus = (s: string) => setStatus((prev) => (prev === s ? "TODOS" : s));

  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!filtered.length || exporting) return;
    setExporting(true);
    try {
      const headers = [
        "Rank",
        "Código",
        "Cliente",
        "CNPJ",
        "Cidade",
        "UF",
        "Dias sem compra",
        "Status",
        "Movimento",
        "Faturamento 12m",
      ];
      const rows = filtered.map((c) => [
        c.rank ?? "",
        c.cod_cliente,
        c.nome,
        c.cnpj_digits,
        c.cidade,
        c.uf ?? "",
        c.dias_sem_compra ?? "",
        STATUS_META[c.status]?.label ?? c.status,
        MOVIMENTO_LABEL[c.movimento] ?? "",
        formatBRL(c.faturamento_12m, false),
      ]);
      const csv = buildCsv(headers, rows);
      const stamp = new Date().toISOString().slice(0, 10);
      const shared = await exportCsv(`crm_byvision_${stamp}.csv`, csv);
      if (Platform.OS !== "web" && !shared) {
        Alert.alert("Exportar CRM", "Compartilhamento indisponível neste dispositivo.");
      }
    } catch {
      Alert.alert("Exportar CRM", "Não foi possível exportar a lista. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };

  const header = <LogoHeader title="CRM & Ranking" onBack={() => router.back()} />;

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

  const listHeader = (
    <View style={{ gap: 14 }}>
      {/* Resumo (adequa-se ao filtro) */}
      <View style={styles.summaryGrid}>
        <SummaryCard label="Total" value={String(summary.total)} dot={colors.info} active={status === "TODOS"} onPress={() => setStatus("TODOS")} testID="summary-total" />
        <SummaryCard label="Ativos" value={String(summary.ativos)} sub={formatPct(summary.pctA)} dot={colors.success} active={status === "ATIVO"} onPress={() => toggleStatus("ATIVO")} testID="summary-ativos" />
        <SummaryCard label="Pré-inativos" value={String(summary.pre)} sub={formatPct(summary.pctP)} dot={colors.warning} active={status === "PRE_INATIVO"} onPress={() => toggleStatus("PRE_INATIVO")} testID="summary-pre" />
        <SummaryCard label="Inativos" value={String(summary.inativos)} sub={formatPct(summary.pctI)} dot={colors.error} active={status === "INATIVO"} onPress={() => toggleStatus("INATIVO")} testID="summary-inativos" />
      </View>

      {/* Filtros com títulos */}
      <View style={styles.filtersRow}>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Cidade</Text>
          <SelectDropdown label="Cidade" value={cidade} options={cityOptions} onChange={setCidade} testID="filter-cidade" />
        </View>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Cliente</Text>
          <SelectDropdown label="Cliente" value={cod} options={clientOptions} onChange={setCod} testID="filter-cliente" />
        </View>
        <View style={styles.filterField}>
          <Text style={styles.filterLabel}>Status</Text>
          <SelectDropdown label="Status" value={status} options={statusOptions} onChange={setStatus} testID="filter-status" />
        </View>
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

      {/* Barra de resultados + exportar */}
      <View style={styles.resultsBar}>
        <Text style={styles.resultsCount}>{`${filtered.length} cliente${filtered.length === 1 ? "" : "s"}`}</Text>
        <Pressable
          style={[styles.exportBtn, (!filtered.length || exporting) && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={!filtered.length || exporting}
          testID="crm-export"
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.onBrandPrimary} />
          ) : (
            <Icon name="tray-arrow-down" size={16} color={colors.onBrandPrimary} />
          )}
          <Text style={styles.exportText}>Exportar</Text>
        </Pressable>
      </View>

      {/* Cabeçalho da tabela */}
      <View style={styles.tableHead}>
        <Text style={[styles.thCliente, styles.thText]}>Cliente</Text>
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
        renderItem={({ item }) => <Row item={item} onPress={() => router.push(`/crm/${item.cod_cliente}`)} />}
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
  const isTop3 = item.rank != null && item.rank <= 3;

  return (
    <Pressable style={[styles.row, isTop3 && styles.rowTop3]} onPress={onPress} testID={`crm-row-${item.cod_cliente}`}>
      <View style={styles.tdCliente}>
        <View style={styles.nameRow}>
          {isTop3 && <Icon name="trophy" size={15} color={colors.warning} />}
          <Text style={styles.name} numberOfLines={1}>
            {item.nome}
          </Text>
        </View>
        <View style={styles.subRow}>
          <Text style={styles.sub} numberOfLines={1}>{`#${item.cod_cliente} · ${item.cidade}`}</Text>
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
      <Text style={[styles.tdDias, styles.diasText]}>{item.dias_sem_compra ?? "—"}</Text>
      <View style={styles.tdStatus}>
        <View style={[styles.statusBadge, { backgroundColor: stColor + "22" }]}>
          <Text style={[styles.statusText, { color: stColor }]}>{st.label.toUpperCase()}</Text>
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
  active,
  onPress,
  testID,
}: {
  label: string;
  value: string;
  sub?: string;
  dot: string;
  active?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.summaryCard, active && { borderColor: dot, borderWidth: 1.5, backgroundColor: dot + "1A" }]}
      testID={testID}
    >
      <View style={styles.summaryTop}>
        <View style={[styles.summaryDot, { backgroundColor: dot }]} />
        <Text style={styles.summaryLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
        {value}
      </Text>
      {!!sub && <Text style={styles.summarySub}>{sub}</Text>}
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: c.muted, textAlign: "center" },
  retryBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 14 },

  filtersRow: { flexDirection: "row", gap: 8 },
  filterField: { flex: 1, gap: 5 },
  filterLabel: { fontFamily: fonts.semibold, fontSize: 12, color: c.muted, marginLeft: 2 },
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
  summaryLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary },
  summaryValue: { fontFamily: fonts.numBold, fontSize: 24, color: c.onSurface },
  summarySub: { fontFamily: fonts.numMedium, fontSize: 12, color: c.muted },

  resultsBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  resultsCount: { fontFamily: fonts.semibold, fontSize: 13, color: c.onSurfaceSecondary },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: c.brandPrimary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportText: { fontFamily: fonts.bold, fontSize: 13, color: c.onBrandPrimary },

  tableHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginTop: 4,
  },
  thText: { fontFamily: fonts.semibold, fontSize: 11, color: c.muted },
  thCliente: { flex: 1 },
  thDias: { width: 54, textAlign: "center" },
  thStatus: { width: 90, textAlign: "center" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
    borderRadius: 8,
  },
  rowTop3: {
    backgroundColor: c.brandTertiary,
    borderBottomColor: "transparent",
    marginBottom: 2,
  },
  tdCliente: { flex: 1, paddingRight: 8, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  subRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  sub: { fontFamily: fonts.numMedium, fontSize: 11, color: c.muted, maxWidth: "70%" },
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
  tdDias: { width: 54, textAlign: "center" },
  diasText: { fontFamily: fonts.numMedium, fontSize: 14, color: c.onSurface },
  tdStatus: { width: 90, alignItems: "center" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  statusText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.4 },

  empty: { alignItems: "center", gap: 10, paddingVertical: 40 },
}));
