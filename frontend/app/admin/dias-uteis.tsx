import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
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
import { useAuth } from "@/src/context/auth";
import { formatDateBR } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

type Holiday = { date: string; nome: string | null };
type DiasUteis = {
  total_bruto: number;
  total: number;
  decorridos: number;
  restantes: number;
  feriados_mes: number;
};
type Resp = { holidays: Holiday[]; ref_month: string; dias_uteis: DiasUteis };

function maskDate(t: string): string {
  const d = t.replace(/\D/g, "").slice(0, 8);
  const parts = [d.slice(0, 2), d.slice(2, 4), d.slice(4, 8)].filter(Boolean);
  return parts.join("/");
}

// "DD/MM/AAAA" -> "AAAA-MM-DD" ou null se invalido
function toISO(masked: string): string | null {
  const m = masked.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const mon = Number(mm);
  if (mon < 1 || mon > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Number(yyyy), mon - 1, day);
  if (dt.getMonth() !== mon - 1 || dt.getDate() !== day) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const idx = Number(m) - 1;
  return `${names[idx] ?? m} de ${y}`;
}

export default function AdminDiasUteis() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [dateStr, setDateStr] = useState("");
  const [nome, setNome] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["holidays"],
    queryFn: () => apiFetch<Resp>("/admin/holidays"),
    enabled: user?.role === "admin",
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["holidays"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["admin-vendedores"] });
  };

  const add = useMutation({
    mutationFn: (body: { date: string; nome: string }) =>
      apiFetch("/admin/holidays", { method: "POST", body }),
    onSuccess: () => {
      invalidateAll();
      setDateStr("");
      setNome("");
      toast("Feriado adicionado", "success");
    },
    onError: () => toast("Erro ao adicionar feriado", "error"),
  });

  const del = useMutation({
    mutationFn: (date: string) => apiFetch(`/admin/holidays/${date}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidateAll();
      toast("Feriado removido", "success");
    },
    onError: () => toast("Erro ao remover", "error"),
  });

  if (user?.role !== "admin") return <Redirect href="/dashboard" />;

  function onAdd() {
    const iso = toISO(dateStr);
    if (!iso) {
      toast("Data inválida. Use DD/MM/AAAA", "error");
      return;
    }
    add.mutate({ date: iso, nome: nome.trim() });
  }

  const du = data?.dias_uteis;

  const header = <LogoHeader title="Dias Úteis & Feriados" onBack={() => router.back()} />;

  const listHeader = (
    <View style={{ gap: 14 }}>
      {/* Resumo do mês de referência */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>MÊS DE REFERÊNCIA</Text>
        <Text style={styles.summaryMonth}>{data ? monthLabel(data.ref_month) : "—"}</Text>
        <View style={styles.statsRow}>
          <Stat label="Dias úteis" value={du ? String(du.total) : "—"} hint={du && du.feriados_mes > 0 ? `de ${du.total_bruto} (−${du.feriados_mes})` : "no mês"} />
          <Stat label="Decorridos" value={du ? String(du.decorridos) : "—"} hint="até hoje" />
          <Stat label="Restantes" value={du ? String(du.restantes) : "—"} hint="úteis" />
        </View>
        <Text style={styles.helpText}>
          Feriados cadastrados reduzem os dias úteis do mês e deixam o cálculo de ritmo (provisionado) mais preciso.
        </Text>
      </View>

      {/* Formulário de adicionar */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Adicionar feriado</Text>
        <View style={styles.formRow}>
          <View style={styles.dateWrap}>
            <Icon name="calendar" size={18} color={colors.muted} />
            <TextInput
              value={dateStr}
              onChangeText={(t) => setDateStr(maskDate(t))}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              style={styles.dateInput}
              maxLength={10}
              testID="holiday-date-input"
            />
          </View>
        </View>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Descrição (opcional). Ex.: Independência"
          placeholderTextColor={colors.muted}
          style={styles.nomeInput}
          testID="holiday-name-input"
        />
        <Pressable
          style={[styles.addBtn, add.isPending && { opacity: 0.7 }]}
          onPress={onAdd}
          disabled={add.isPending}
          testID="add-holiday-button"
        >
          {add.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Icon name="plus" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.addText}>Adicionar feriado</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>
        {`Feriados cadastrados (${data?.holidays.length ?? 0})`}
      </Text>
    </View>
  );

  return (
    <View style={styles.screen}>
      {header}
      {isLoading ? (
        <View style={styles.centerFill}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <FlatList
          data={data?.holidays ?? []}
          keyExtractor={(h) => h.date}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => (
            <View style={styles.row} testID={`holiday-row-${item.date}`}>
              <View style={styles.rowIcon}>
                <Icon name="calendar-remove" size={20} color={colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowDate}>{formatDateBR(item.date)}</Text>
                {!!item.nome && <Text style={styles.rowName}>{item.nome}</Text>}
              </View>
              <Pressable
                style={styles.delBtn}
                onPress={() => del.mutate(item.date)}
                testID={`del-holiday-${item.date}`}
              >
                <Icon name="trash-can-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum feriado cadastrado.</Text>}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          testID="holiday-list"
        />
      )}
    </View>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {!!hint && <Text style={styles.statHint}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },

  summaryCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    padding: 18,
    gap: 10,
  },
  summaryLabel: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.5 },
  summaryMonth: { fontFamily: fonts.bold, fontSize: 20, color: c.onSurface, textTransform: "capitalize" },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  stat: {
    flex: 1,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    gap: 2,
  },
  statValue: { fontFamily: fonts.numBold, fontSize: 24, color: c.brand },
  statLabel: { fontFamily: fonts.semibold, fontSize: 11, color: c.onSurfaceSecondary },
  statHint: { fontFamily: fonts.regular, fontSize: 10, color: c.muted },
  helpText: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, lineHeight: 17 },

  formCard: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    gap: 12,
  },
  formTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  formRow: { flexDirection: "row", gap: 10 },
  dateWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.borderStrong,
    paddingHorizontal: 12,
    height: 48,
  },
  dateInput: {
    flex: 1,
    fontFamily: fonts.numMedium,
    fontSize: 16,
    color: c.onSurface,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  nomeInput: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    height: 48,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.onSurface,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.brandPrimary,
    height: 48,
    borderRadius: 12,
  },
  addText: { fontFamily: fonts.bold, fontSize: 15, color: c.onBrandPrimary },

  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface, marginTop: 2 },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, textAlign: "center", paddingVertical: 24 },

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
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowDate: { fontFamily: fonts.numBold, fontSize: 15, color: c.onSurface },
  rowName: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  delBtn: { padding: 8 },
}));
