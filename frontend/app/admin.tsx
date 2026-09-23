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
import { Icon, IconName } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { MenuSheet } from "@/src/components/menu-sheet";
import { useToast } from "@/src/components/toast";
import { useAuth } from "@/src/context/auth";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Vendedor = {
  cod_vendedor: number;
  nome: string | null;
  email: string | null;
  ativo: number | null;
  qt_clientes: number;
  synced: boolean;
  syncing: boolean;
  synced_at: string | null;
  faturado?: number;
  meta?: number;
  pct?: number | null;
  total_clientes?: number;
  ativos?: number;
  pre_inativos?: number;
  inativos?: number;
};

type Resp = {
  ref_month: string;
  period: { total_dias_uteis?: number; dias_uteis_decorridos?: number };
  totals: { faturado: number; meta: number; pct: number | null; vendedores: number; sincronizados: number };
  vendedores: Vendedor[];
};

export default function AdminHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin-vendedores"],
    queryFn: () => apiFetch<Resp>("/admin/vendedores"),
    enabled: user?.role === "admin",
    refetchInterval: (q) => (q.state.data?.vendedores?.some((v) => v.syncing) ? 3000 : false),
  });

  const syncOne = useMutation({
    mutationFn: (cod: number) => apiFetch(`/admin/vendedores/${cod}/sync`, { method: "POST" }),
    onSuccess: () => {
      toast("Sincronização iniciada", "success");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin-vendedores"] }), 800);
    },
    onError: () => toast("Falha ao sincronizar", "error"),
  });

  const syncAll = useMutation({
    mutationFn: () => apiFetch("/admin/vendedores/sync-all", { method: "POST" }),
    onSuccess: () => {
      toast("Sincronizando todos os vendedores…", "success");
      setTimeout(() => qc.invalidateQueries({ queryKey: ["admin-vendedores"] }), 800);
    },
    onError: () => toast("Falha ao sincronizar", "error"),
  });

  if (user?.role !== "admin") return <Redirect href="/dashboard" />;

  const header = <LogoHeader onMenu={() => setMenuOpen(true)} title="Painel Admin" />;

  if (isLoading) {
    return (
      <View style={styles.screen}>
        {header}
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.centerText}>Carregando vendedores…</Text>
        </View>
        <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
        <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
      </View>
    );
  }

  const expFrac =
    data.period.total_dias_uteis && data.period.dias_uteis_decorridos != null
      ? (data.period.dias_uteis_decorridos || 0) / (data.period.total_dias_uteis || 1)
      : 1;

  const q = search.trim().toLowerCase();
  const list = q
    ? data.vendedores.filter(
        (v) => (v.nome || "").toLowerCase().includes(q) || String(v.cod_vendedor).includes(q),
      )
    : data.vendedores;

  const totPct = data.totals.pct ?? 0;
  const totTone = paceTone(totPct, expFrac, colors);

  const listHeader = (
    <View style={styles.listHeader}>
      {/* Totais gerais */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>DESEMPENHO GERAL DO MÊS</Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={[styles.summaryValue, { color: totTone }]}>{formatBRL(data.totals.faturado)}</Text>
            <Text style={styles.summarySub}>Faturado</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.summaryValue}>{formatBRL(data.totals.meta)}</Text>
            <Text style={styles.summarySub}>Meta</Text>
          </View>
        </View>
        <View style={styles.summaryTrack}>
          <View style={[styles.summaryFill, { width: `${Math.max(0, Math.min(1, totPct)) * 100}%`, backgroundColor: totTone }]} />
        </View>
        <Text style={styles.summaryMeta}>
          {`${data.totals.sincronizados}/${data.totals.vendedores} vendedores sincronizados`}
        </Text>
      </View>

      {/* Atalhos */}
      <View style={styles.shortcuts}>
        <NavCard icon="tune-variant" label="Gestão de Metas" onPress={() => router.push("/admin/metas")} testID="nav-metas" />
        <NavCard icon="account-cog-outline" label="Usuários" onPress={() => router.push("/admin/users")} testID="nav-users" />
      </View>

      <Pressable
        style={[styles.syncAllBtn, syncAll.isPending && { opacity: 0.7 }]}
        onPress={() => syncAll.mutate()}
        disabled={syncAll.isPending}
        testID="sync-all-button"
      >
        <Icon name="sync" size={18} color={colors.onBrandPrimary} />
        <Text style={styles.syncAllText}>Sincronizar todos</Text>
      </Pressable>

      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar vendedor…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          testID="vendedor-search"
        />
      </View>

      <Text style={styles.sectionTitle}>{`Vendedores (${list.length})`}</Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        data={list}
        keyExtractor={(v) => String(v.cod_vendedor)}
        ListHeaderComponent={listHeader}
        renderItem={({ item }) => (
          <VendedorRow
            item={item}
            expFrac={expFrac}
            onOpen={() => router.push({ pathname: "/admin/vendedor/[cod]", params: { cod: String(item.cod_vendedor), nome: item.nome || `Vendedor ${item.cod_vendedor}` } })}
            onSync={() => syncOne.mutate(item.cod_vendedor)}
          />
        )}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.brandPrimary} />}
        testID="admin-vendedor-list"
      />
      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function paceTone(pct: number, expFrac: number, colors: any) {
  const ritmo = expFrac > 0 ? pct / expFrac : pct >= 1 ? 1 : 0;
  return ritmo >= 1 ? colors.success : ritmo >= 0.76 ? colors.warning : colors.error;
}

function NavCard({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={styles.navCard} onPress={onPress} testID={testID}>
      <Icon name={icon} size={24} color={colors.brand} />
      <Text style={styles.navLabel}>{label}</Text>
    </Pressable>
  );
}

function VendedorRow({
  item,
  expFrac,
  onOpen,
  onSync,
}: {
  item: Vendedor;
  expFrac: number;
  onOpen: () => void;
  onSync: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const hasMeta = (item.meta ?? 0) > 0;
  const pct = item.pct ?? 0;
  const tone = hasMeta ? paceTone(pct, expFrac, colors) : colors.borderStrong;

  return (
    <Pressable
      style={styles.row}
      onPress={item.synced ? onOpen : undefined}
      disabled={!item.synced}
      testID={`vendedor-row-${item.cod_vendedor}`}
    >
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.nome || `Vendedor ${item.cod_vendedor}`}
          </Text>
          <Text style={styles.rowSub}>{`#${item.cod_vendedor} • ${item.qt_clientes} clientes`}</Text>
        </View>
        {item.synced && hasMeta && (
          <View style={[styles.pctBadge, { backgroundColor: tone }]}>
            <Text style={styles.pctText}>{formatPct(pct)}</Text>
          </View>
        )}
      </View>

      {item.syncing ? (
        <View style={styles.syncingRow}>
          <ActivityIndicator size="small" color={colors.brandPrimary} />
          <Text style={styles.syncingText}>Sincronizando…</Text>
        </View>
      ) : item.synced ? (
        <>
          <View style={styles.statsRow}>
            <Stat label="Faturado" value={formatBRL(item.faturado ?? 0)} />
            <Stat label="Meta" value={hasMeta ? formatBRL(item.meta ?? 0) : "—"} />
          </View>
          <View style={styles.chipsRow}>
            <MiniChip color={colors.success} label={`${item.ativos ?? 0} ativos`} />
            <MiniChip color={colors.warning} label={`${item.pre_inativos ?? 0} pré`} />
            <MiniChip color={colors.error} label={`${item.inativos ?? 0} inativos`} />
            <View style={{ marginLeft: "auto" }}>
              <Icon name="chevron-right" size={18} color={colors.muted} />
            </View>
          </View>
        </>
      ) : (
        <Pressable style={styles.syncBtn} onPress={onSync} testID={`sync-vendedor-${item.cod_vendedor}`}>
          <Icon name="cloud-download-outline" size={16} color={colors.brand} />
          <Text style={styles.syncBtnText}>Sincronizar dados</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
  );
}

function MiniChip({ color, label }: { color: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.miniChip, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.miniChipText, { color }]}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  centerText: { fontFamily: fonts.medium, fontSize: 14, color: c.muted, textAlign: "center" },
  retryBtn: { backgroundColor: c.brandPrimary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  retryText: { fontFamily: fonts.bold, color: c.onBrandPrimary, fontSize: 14 },

  listHeader: { gap: 12, marginBottom: 4 },
  summaryCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    padding: 18,
    gap: 12,
  },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  summaryValue: { fontFamily: fonts.numBold, fontSize: 24, color: c.onSurface },
  summarySub: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  summaryTrack: { height: 12, borderRadius: 4, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  summaryFill: { height: "100%", borderRadius: 0 },
  summaryMeta: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },

  shortcuts: { flexDirection: "row", gap: 12 },
  navCard: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    paddingVertical: 18,
    alignItems: "center",
    gap: 8,
  },
  navLabel: { fontFamily: fonts.semibold, fontSize: 13, color: c.onSurface },

  syncAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.brandPrimary,
    height: 46,
    borderRadius: 12,
  },
  syncAllText: { fontFamily: fonts.bold, fontSize: 14, color: c.onBrandPrimary },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    height: 48,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 2 },

  row: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 10,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowName: { fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  rowSub: { fontFamily: fonts.regular, fontSize: 11, color: c.muted, marginTop: 2 },
  pctBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  pctText: { fontFamily: fonts.numBold, fontSize: 13, color: "#ffffff" },

  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1 },
  statLabel: { fontFamily: fonts.regular, fontSize: 10, color: c.muted },
  statValue: { fontFamily: fonts.numMedium, fontSize: 14, color: c.onSurfaceSecondary },

  chipsRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  miniChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  miniChipText: { fontFamily: fonts.semibold, fontSize: 10.5 },

  syncingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  syncingText: { fontFamily: fonts.medium, fontSize: 13, color: c.muted },
  syncBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: c.brand,
    borderRadius: 10,
    height: 40,
  },
  syncBtnText: { fontFamily: fonts.semibold, fontSize: 13, color: c.brand },
}));
