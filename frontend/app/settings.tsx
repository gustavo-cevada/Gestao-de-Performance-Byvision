import { useRouter } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/src/components/icon";
import { LogoHeader } from "@/src/components/logo-header";
import { useAuth } from "@/src/context/auth";
import { Mode, useColorMode } from "@/src/theme-mode";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

const OPTIONS: { key: Mode; label: string; icon: IconName }[] = [
  { key: "light", label: "Claro", icon: "white-balance-sunny" },
  { key: "dark", label: "Escuro", icon: "weather-night" },
  { key: "system", label: "Sistema", icon: "cellphone-cog" },
];

export default function Settings() {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, change } = useColorMode();

  async function onLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <View style={styles.screen}>
      <LogoHeader title="Configurações" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}>
        {/* Perfil */}
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Icon name={user?.role === "admin" ? "shield-account" : "account"} size={28} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.nome ?? user?.username}</Text>
            <Text style={styles.role}>{user?.role === "admin" ? "Administrador" : "Vendedor"}</Text>
          </View>
        </View>

        {/* Tema */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aparência</Text>
          <View style={styles.segment}>
            {OPTIONS.map((o) => {
              const active = mode === o.key;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => change(o.key)}
                  style={[styles.segItem, active && { backgroundColor: colors.brandPrimary }]}
                  testID={`theme-${o.key}`}
                >
                  <Icon name={o.icon} size={18} color={active ? colors.onBrandPrimary : colors.onSurfaceTertiary} />
                  <Text style={[styles.segText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Sobre */}
        <View style={styles.card}>
          <Icon name="information-outline" size={20} color={colors.muted} />
          <Text style={styles.aboutText}>
            Os dados de clientes e faturamento são sincronizados com o Data Warehouse Byvision. As metas
            são definidas pelo administrador.
          </Text>
        </View>

        <Pressable style={styles.logoutBtn} onPress={onLogout} testID="logout-button">
          <Icon name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  screen: { flex: 1, backgroundColor: c.surface },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.brandPrimary,
    justifyContent: "center",
    alignItems: "center",
  },
  name: { fontFamily: fonts.bold, fontSize: 16, color: c.onSurface },
  role: { fontFamily: fonts.medium, fontSize: 13, color: c.muted, marginTop: 2 },
  section: { gap: 10 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.onSurface },
  segment: {
    flexDirection: "row",
    backgroundColor: c.surfaceTertiary,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segItem: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignItems: "center",
    height: 44,
    borderRadius: 9,
  },
  segText: { fontFamily: fonts.semibold, fontSize: 13 },
  aboutText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.muted, lineHeight: 19 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.error,
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: c.error },
}));
