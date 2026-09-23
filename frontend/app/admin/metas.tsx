import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiFetch } from "@/src/api/client";
import { Icon } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { useToast } from "@/src/components/toast";
import { VendedorPicker } from "@/src/components/vendedor-picker";
import { useAuth } from "@/src/context/auth";
import { formatBRL } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type MetaClient = { cod_cliente: string; nome: string; cidade: string; meta: number; faturado: number };
type MetasResp = { total_meta: number; clients: MetaClient[] };
type Vendedor = { cod_vendedor: number; nome: string | null; synced: boolean; qt_clientes: number };
type VendResp = { vendedores: Vendedor[] };

export default function AdminMetas() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [vend, setVend] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const vendedores = useQuery({
    queryKey: ["admin-vendedores"],
    queryFn: () => apiFetch<VendResp>("/admin/vendedores"),
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (vend == null && vendedores.data) {
      const synced = vendedores.data.vendedores.filter((v) => v.synced);
      const preferred = synced.find((v) => v.cod_vendedor === user?.cod_vendedor) || synced[0];
      if (preferred) setVend(preferred.cod_vendedor);
    }
  }, [vendedores.data, vend, user]);

  const { data, isLoading } = useQuery({
    queryKey: ["metas", vend],
    queryFn: () => apiFetch<MetasResp>(`/admin/metas?vendedor=${vend}`),
    enabled: user?.role === "admin" && vend != null,
  });

  useEffect(() => {
    if (data) {
      const init: Record<string, string> = {};
      data.clients.forEach((c) => {
        init[c.cod_cliente] = String(c.meta ?? 0);
      });
      setValues(init);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (metas: { cod_cliente: string; meta: number }[]) =>
      apiFetch("/admin/metas", { method: "PUT", body: { metas } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["metas"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["admin-vendedores"] });
      toast("Metas salvas com sucesso", "success");
    },
    onError: () => toast("Erro ao salvar metas", "error"),
  });

  const total = useMemo(
    () => Object.values(values).reduce((s, v) => s + (parseFloat(v.replace(",", ".")) || 0), 0),
    [values],
  );

  if (user?.role !== "admin") return <Redirect href="/dashboard" />;

  const filtered = (data?.clients ?? []).filter((c) =>
    search ? c.nome.toLowerCase().includes(search.toLowerCase()) || c.cod_cliente.includes(search) : true,
  );

  function onSave() {
    const metas = Object.entries(values).map(([cod_cliente, v]) => ({
      cod_cliente,
      meta: parseFloat(v.replace(",", ".")) || 0,
    }));
    save.mutate(metas);
  }

  const selectedName =
    vendedores.data?.vendedores.find((v) => v.cod_vendedor === vend)?.nome || (vend ? `Vendedor ${vend}` : "Selecionar");

  const header = <LogoHeader title="Gestão de Metas" onBack={() => router.back()} />;

  return (
    <View style={styles.screen}>
      {header}

      <View style={styles.topBar}>
        <Pressable style={styles.vendPill} onPress={() => setPickerOpen(true)} testID="vendedor-pill">
          <Icon name="account-tie-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.vendText} numberOfLines={1}>
            {selectedName}
          </Text>
          <Icon name="chevron-down" size={18} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Icon name="magnify" size={20} color={colors.muted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar cliente…"
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          testID="admin-search"
        />
      </View>

      {isLoading || vend == null ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.cod_cliente}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <View style={styles.row} testID={`meta-row-${item.cod_cliente}`}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.nome}
                </Text>
                <Text style={styles.rowSub}>
                  {`#${item.cod_cliente} • ${item.cidade} • Fat. ${formatBRL(item.faturado)}`}
                </Text>
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.currency}>R$</Text>
                <TextInput
                  value={values[item.cod_cliente] ?? ""}
                  onChangeText={(t) => setValues((prev) => ({ ...prev, [item.cod_cliente]: t.replace(/[^0-9.,]/g, "") }))}
                  keyboardType="decimal-pad"
                  style={styles.metaInput}
                  testID={`meta-input-${item.cod_cliente}`}
                />
              </View>
            </View>
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 140 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum cliente para este vendedor.</Text>}
          testID="admin-meta-list"
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View>
          <Text style={styles.footerLabel}>Soma total das metas</Text>
          <Text style={styles.footerTotal}>{formatBRL(total)}</Text>
        </View>
        <Pressable
          style={[styles.saveBtn, save.isPending && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={save.isPending || vend == null}
          testID="save-metas-button"
        >
          {save.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Icon name="content-save-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.saveText}>Salvar</Text>
            </>
          )}
        </Pressable>
      </View>

      <VendedorPicker
        visible={pickerOpen}
        vendedores={vendedores.data?.vendedores ?? []}
        selected={vend}
        onlySynced
        onSelect={setVend}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  topBar: { paddingHorizontal: 16, paddingTop: 14 },
  vendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  vendText: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
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
    margin: 16,
    marginBottom: 4,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.onSurface,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, textAlign: "center", paddingVertical: 30 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
  },
  rowInfo: { flex: 1, gap: 3 },
  rowName: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  rowSub: { fontFamily: fonts.regular, fontSize: 11, color: c.muted },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.borderStrong,
    paddingHorizontal: 10,
    height: 44,
    width: 120,
  },
  currency: { fontFamily: fonts.numMedium, fontSize: 13, color: c.muted },
  metaInput: {
    flex: 1,
    fontFamily: fonts.numBold,
    fontSize: 15,
    color: c.onSurface,
    textAlign: "right",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  footerLabel: { fontFamily: fonts.medium, fontSize: 12, color: c.muted },
  footerTotal: { fontFamily: fonts.numBold, fontSize: 22, color: c.brand },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 12,
  },
  saveText: { fontFamily: fonts.bold, fontSize: 15, color: c.onBrandPrimary },
}));
