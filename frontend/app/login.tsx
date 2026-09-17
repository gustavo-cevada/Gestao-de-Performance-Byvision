import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/icon";
import { useAuth } from "@/src/context/auth";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

const LOGO = require("../assets/images/byvision-logo.png");

export default function Login() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!identifier.trim() || !password) {
      setError("Preencha usuário e senha.");
      return;
    }
    setBusy(true);
    setError("");
    const err = await login(identifier.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <View style={styles.container}>
      <View style={[styles.hero, { paddingTop: insets.top + 40 }]}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <Text style={styles.heroTitle}>Gestão de Performance</Text>
        <Text style={styles.heroSubtitle}>Acompanhe suas metas e clientes em tempo real</Text>
      </View>

      <KeyboardAwareScrollView
        style={styles.formWrap}
        contentContainerStyle={styles.formContent}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.formTitle}>Entrar</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Usuário</Text>
          <View style={styles.inputRow}>
            <Icon name="account-outline" size={20} color={colors.muted} />
            <TextInput
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="ex.: VAGNER"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              testID="login-identifier-input"
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
              testID="login-password-input"
            />
            <Pressable onPress={() => setShowPass((v) => !v)} hitSlop={8} testID="toggle-password">
              <Icon name={showPass ? "eye-off-outline" : "eye-outline"} size={20} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {!!error && (
          <Text style={styles.error} testID="login-error">
            {error}
          </Text>
        )}

        <Pressable
          onPress={onSubmit}
          disabled={busy}
          style={[styles.button, busy && { opacity: 0.7 }]}
          testID="login-submit-button"
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.buttonText}>Entrar</Text>
          )}
        </Pressable>

        <View style={styles.hintBox}>
          <Icon name="information-outline" size={16} color={colors.muted} />
          <Text style={styles.hintText}>
            Acesso demo — Vendedor: VAGNER / vagner123 · Admin: admin / admin123
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, backgroundColor: c.surface },
  hero: {
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 24,
    paddingBottom: 36,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  logo: { width: 190, height: 58 },
  heroTitle: { fontFamily: fonts.bold, fontSize: 22, color: c.onBrandPrimary, marginTop: 18 },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.onBrandPrimary,
    opacity: 0.9,
    marginTop: 6,
    textAlign: "center",
  },
  formWrap: { flex: 1 },
  formContent: { padding: 24, gap: 16, maxWidth: 520, width: "100%", alignSelf: "center" },
  formTitle: { fontFamily: fonts.bold, fontSize: 20, color: c.onSurface, marginTop: 8 },
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
  button: {
    backgroundColor: c.brandPrimary,
    height: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 16, color: c.onBrandPrimary },
  hintBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 10,
    padding: 12,
  },
  hintText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: c.muted },
}));
