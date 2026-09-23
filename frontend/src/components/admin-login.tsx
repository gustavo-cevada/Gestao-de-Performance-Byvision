import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/icon";
import { useAuth } from "@/src/context/auth";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

const LOGO = require("../../assets/images/byvision-logo.png");

export function AdminLogin() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { login, logout } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const wide = width >= 900;

  async function onSubmit() {
    if (!identifier.trim() || !password) {
      setError("Preencha usuário e senha.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await login(identifier.trim(), password);
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    if (res.user?.role !== "admin") {
      await logout();
      setBusy(false);
      setError("Esta conta não tem acesso administrativo.");
      return;
    }
    // sucesso: o componente pai (/admin) re-renderiza e mostra o painel
    setBusy(false);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.split, wide && styles.splitWide]}>
        {/* Lado da marca (visível no desktop) */}
        {wide && (
          <View style={styles.brandPane}>
            <Image source={LOGO} style={styles.brandLogo} contentFit="contain" />
            <Text style={styles.brandTitle}>Painel Administrativo</Text>
            <Text style={styles.brandSubtitle}>
              Gestão de Performance de Vendas — acompanhe todos os vendedores, defina metas e gerencie usuários.
            </Text>
            <View style={styles.brandBadges}>
              <Badge icon="chart-box-outline" label="Desempenho por vendedor" />
              <Badge icon="target" label="Metas por cliente" />
              <Badge icon="account-cog-outline" label="Gestão de usuários" />
            </View>
          </View>
        )}

        {/* Lado do formulário */}
        <KeyboardAwareScrollView
          style={styles.formPane}
          contentContainerStyle={[styles.formContent, { paddingTop: wide ? 40 : insets.top + 40 }]}
          bottomOffset={20}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            {!wide && <Image source={LOGO} style={styles.mobileLogo} contentFit="contain" />}
            <View style={styles.lockRow}>
              <View style={styles.lockCircle}>
                <Icon name="shield-lock" size={22} color={colors.onBrandPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.formTitle}>Acesso Administrativo</Text>
                <Text style={styles.formHint}>Somente administradores</Text>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Usuário</Text>
              <View style={styles.inputRow}>
                <Icon name="account-outline" size={20} color={colors.muted} />
                <TextInput
                  value={identifier}
                  onChangeText={setIdentifier}
                  placeholder="ex.: admin"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                  testID="admin-login-identifier"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Senha</Text>
              <View style={styles.inputRow}>
                <Icon name="lock-outline" size={20} color={colors.muted} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPass}
                  style={styles.input}
                  onSubmitEditing={onSubmit}
                  testID="admin-login-password"
                />
                <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} testID="admin-toggle-password">
                  <Icon name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
                </Pressable>
              </View>
            </View>

            {!!error && (
              <Text style={styles.error} testID="admin-login-error">
                {error}
              </Text>
            )}

            <Pressable onPress={onSubmit} disabled={busy} style={[styles.button, busy && { opacity: 0.7 }]} testID="admin-login-submit">
              {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.buttonText}>Entrar no painel</Text>}
            </Pressable>

            <View style={styles.hintBox}>
              <Icon name="information-outline" size={16} color={colors.muted} />
              <Text style={styles.hintText}>Vendedores devem usar o aplicativo. Este acesso é exclusivo para gestão.</Text>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
}

function Badge({ icon, label }: { icon: any; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.badge}>
      <Icon name={icon} size={18} color={colors.onBrandPrimary} />
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  split: { flex: 1 },
  splitWide: { flexDirection: "row" },

  brandPane: {
    flex: 1,
    backgroundColor: c.brandPrimary,
    padding: 56,
    justifyContent: "center",
    gap: 18,
  },
  brandLogo: { width: 220, height: 64 },
  brandTitle: { fontFamily: fonts.bold, fontSize: 34, color: c.onBrandPrimary, marginTop: 8 },
  brandSubtitle: { fontFamily: fonts.regular, fontSize: 16, color: c.onBrandPrimary, opacity: 0.92, maxWidth: 460, lineHeight: 24 },
  brandBadges: { gap: 12, marginTop: 20 },
  badge: { flexDirection: "row", alignItems: "center", gap: 10 },
  badgeText: { fontFamily: fonts.semibold, fontSize: 15, color: c.onBrandPrimary },

  formPane: { flex: 1 },
  formContent: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    padding: 28,
    gap: 16,
  },
  mobileLogo: { width: 170, height: 50, alignSelf: "center", marginBottom: 4 },
  lockRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lockCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.brandPrimary, justifyContent: "center", alignItems: "center" },
  formTitle: { fontFamily: fonts.bold, fontSize: 20, color: c.onSurface },
  formHint: { fontFamily: fonts.medium, fontSize: 13, color: c.muted, marginTop: 2 },

  field: { gap: 6 },
  label: { fontFamily: fonts.medium, fontSize: 13, color: c.onSurfaceSecondary },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 14,
    height: 52,
  },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.onSurface, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}) },
  error: { fontFamily: fonts.medium, fontSize: 13, color: c.error },
  button: { backgroundColor: c.brandPrimary, height: 54, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 4 },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: c.onBrandPrimary },
  hintBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surfaceTertiary, borderRadius: 10, padding: 12 },
  hintText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: c.muted },
}));
