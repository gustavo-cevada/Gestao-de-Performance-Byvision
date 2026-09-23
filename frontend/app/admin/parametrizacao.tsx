import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
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
import { AppConfig, DEFAULT_LABELS, LABEL_META } from "@/src/context/config";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminParametrizacao() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [labels, setLabels] = useState<Record<string, string>>({});
  const [yellow, setYellow] = useState("76");
  const [green, setGreen] = useState("100");

  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => apiFetch<AppConfig>("/config", { auth: false }),
    enabled: user?.role === "admin",
  });

  useEffect(() => {
    if (data) {
      setLabels(data.labels || {});
      setYellow(String(Math.round((data.thresholds?.yellow ?? 0.76) * 100)));
      setGreen(String(Math.round((data.thresholds?.green ?? 1.0) * 100)));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: (body: { labels: Record<string, string>; thresholds: { yellow: number; green: number } }) =>
      apiFetch("/admin/config", { method: "PUT", body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
      toast("Parametrização salva", "success");
    },
    onError: () => toast("Erro ao salvar", "error"),
  });

  const groups = useMemo(() => {
    const map: Record<string, typeof LABEL_META> = {};
    LABEL_META.forEach((m) => {
      (map[m.grupo] ||= []).push(m);
    });
    return Object.entries(map);
  }, []);

  if (user?.role !== "admin") return <Redirect href="/dashboard" />;

  const yNum = Math.max(0, Math.min(100, parseInt(yellow, 10) || 0));
  const gNum = Math.max(0, Math.min(200, parseInt(green, 10) || 0));
  const validThresholds = gNum > yNum && yNum > 0;

  function onSave() {
    if (!validThresholds) {
      toast("Verde deve ser maior que amarelo", "error");
      return;
    }
    const clean: Record<string, string> = {};
    Object.entries(labels).forEach(([k, v]) => {
      if (String(v).trim()) clean[k] = String(v).trim();
    });
    save.mutate({ labels: clean, thresholds: { yellow: yNum / 100, green: gNum / 100 } });
  }

  const header = <LogoHeader title="Parametrização" onBack={() => router.back()} />;

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

  return (
    <View style={styles.screen}>
      {header}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Regra de cores */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Regra de cores (ritmo de atingimento)</Text>
          <Text style={styles.help}>
            O ritmo compara o faturado com o previsto no tempo (dias úteis). Defina a partir de qual % o indicador
            fica amarelo e verde. Abaixo do amarelo é vermelho.
          </Text>

          <View style={styles.thRow}>
            <View style={styles.thField}>
              <View style={[styles.dot, { backgroundColor: colors.warning }]} />
              <Text style={styles.thLabel}>Amarelo a partir de</Text>
              <View style={styles.thInputWrap}>
                <TextInput
                  value={yellow}
                  onChangeText={(t) => setYellow(t.replace(/[^0-9]/g, "").slice(0, 3))}
                  keyboardType="number-pad"
                  style={styles.thInput}
                  testID="threshold-yellow"
                />
                <Text style={styles.thPct}>%</Text>
              </View>
            </View>

            <View style={styles.thField}>
              <View style={[styles.dot, { backgroundColor: colors.success }]} />
              <Text style={styles.thLabel}>Verde a partir de</Text>
              <View style={styles.thInputWrap}>
                <TextInput
                  value={green}
                  onChangeText={(t) => setGreen(t.replace(/[^0-9]/g, "").slice(0, 3))}
                  keyboardType="number-pad"
                  style={styles.thInput}
                  testID="threshold-green"
                />
                <Text style={styles.thPct}>%</Text>
              </View>
            </View>
          </View>

          {/* Prévia */}
          <View style={styles.previewRow}>
            <Preview color={colors.error} text={`< ${yNum}%`} />
            <Preview color={colors.warning} text={`${yNum}–${gNum - 1}%`} />
            <Preview color={colors.success} text={`≥ ${gNum}%`} />
          </View>
          {!validThresholds && (
            <Text style={styles.errText}>O valor do verde deve ser maior que o do amarelo.</Text>
          )}
        </View>

        {/* Textos */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Textos dos dashboards</Text>
          <Text style={styles.help}>
            Personalize os rótulos exibidos para os vendedores. Deixe em branco para usar o texto padrão.
          </Text>

          {groups.map(([grupo, items]) => (
            <View key={grupo} style={styles.group}>
              <Text style={styles.groupTitle}>{grupo}</Text>
              {items.map((m) => (
                <View key={m.key} style={styles.labelRow}>
                  <Text style={styles.labelName}>{m.nome}</Text>
                  <TextInput
                    value={labels[m.key] ?? ""}
                    onChangeText={(t) => setLabels((prev) => ({ ...prev, [m.key]: t }))}
                    placeholder={DEFAULT_LABELS[m.key]}
                    placeholderTextColor={colors.muted}
                    style={styles.labelInput}
                    testID={`label-${m.key}`}
                  />
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.saveBtn, save.isPending && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={save.isPending}
          testID="save-config-button"
        >
          {save.isPending ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Icon name="content-save-outline" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.saveText}>Salvar parametrização</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Preview({ color, text }: { color: string; text: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.preview, { borderColor: color }]}>
      <Text style={[styles.previewText, { color }]}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  centerFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  help: { fontFamily: fonts.regular, fontSize: 12.5, color: c.muted, lineHeight: 18 },

  thRow: { flexDirection: "row", gap: 12 },
  thField: {
    flex: 1,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    alignItems: "flex-start",
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  thLabel: { fontFamily: fonts.medium, fontSize: 12, color: c.onSurfaceSecondary },
  thInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: c.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.borderStrong,
    paddingHorizontal: 10,
    height: 44,
    alignSelf: "stretch",
  },
  thInput: {
    flex: 1,
    fontFamily: fonts.numBold,
    fontSize: 18,
    color: c.onSurface,
    textAlign: "right",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },
  thPct: { fontFamily: fonts.numBold, fontSize: 16, color: c.muted },

  previewRow: { flexDirection: "row", gap: 8 },
  preview: { flex: 1, borderWidth: 1.5, borderRadius: 999, paddingVertical: 6, alignItems: "center" },
  previewText: { fontFamily: fonts.numBold, fontSize: 12 },
  errText: { fontFamily: fonts.medium, fontSize: 12, color: c.error },

  group: { gap: 8, marginTop: 4 },
  groupTitle: { fontFamily: fonts.semibold, fontSize: 12, color: c.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  labelRow: { gap: 4 },
  labelName: { fontFamily: fonts.medium, fontSize: 12.5, color: c.onSurfaceSecondary },
  labelInput: {
    backgroundColor: c.surfaceTertiary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 12,
    height: 46,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.onSurface,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surfaceSecondary,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: c.brandPrimary,
    height: 50,
    borderRadius: 12,
  },
  saveText: { fontFamily: fonts.bold, fontSize: 15, color: c.onBrandPrimary },
}));
