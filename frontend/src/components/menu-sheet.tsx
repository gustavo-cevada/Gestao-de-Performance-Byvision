import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/src/components/icon";
import { useAuth } from "@/src/context/auth";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

const LOGO = require("../../assets/images/byvision-logo.png");

type Item = { icon: IconName; label: string; route: string; testID: string };

export function MenuSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const items: Item[] =
    user?.role === "admin"
      ? [
          { icon: "shield-crown-outline", label: "Painel Admin", route: "/admin", testID: "menu-admin" },
          { icon: "tune-variant", label: "Gestão de Metas", route: "/admin/metas", testID: "menu-metas" },
          { icon: "calendar-check", label: "Dias Úteis & Feriados", route: "/admin/dias-uteis", testID: "menu-dias-uteis" },
          { icon: "cog-sync-outline", label: "Parametrização", route: "/admin/parametrizacao", testID: "menu-parametrizacao" },
          { icon: "account-cog-outline", label: "Usuários", route: "/admin/users", testID: "menu-users" },
          { icon: "cog-outline", label: "Configurações", route: "/settings", testID: "menu-settings" },
        ]
      : [
          { icon: "view-dashboard-outline", label: "Painel de Performance", route: "/dashboard", testID: "menu-dashboard" },
          { icon: "account-group-outline", label: "CRM & Ranking", route: "/crm", testID: "menu-crm" },
          { icon: "cog-outline", label: "Configurações", route: "/settings", testID: "menu-settings" },
        ];

  function go(route: string) {
    onClose();
    if (route === "/dashboard" || route === "/admin") router.replace(route as any);
    else router.push(route as any);
  }

  async function onLogout() {
    onClose();
    await logout();
    router.replace("/login");
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="menu-backdrop" />
      <View style={[styles.panel, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 16 }]} testID="menu-sheet">
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
        </View>
        <Text style={styles.userName}>{user?.nome ?? user?.username}</Text>
        <Text style={styles.userRole}>{user?.role === "admin" ? "Administrador" : "Vendedor"}</Text>

        <View style={styles.items}>
          {items.map((it) => (
            <Pressable key={it.route} style={styles.item} onPress={() => go(it.route)} testID={it.testID}>
              <Icon name={it.icon} size={22} color={colors.brand} />
              <Text style={styles.itemLabel}>{it.label}</Text>
              <Icon name="chevron-right" size={20} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logout} onPress={onLogout} testID="menu-logout">
          <Icon name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sair da conta</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  panel: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: "80%",
    maxWidth: 340,
    backgroundColor: c.surface,
    paddingHorizontal: 20,
    gap: 4,
  },
  header: {
    backgroundColor: c.brandPrimary,
    alignSelf: "stretch",
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    alignItems: "flex-start",
  },
  logo: { width: 150, height: 40 },
  userName: { fontFamily: fonts.bold, fontSize: 17, color: c.onSurface, marginTop: 16 },
  userRole: { fontFamily: fonts.medium, fontSize: 13, color: c.muted, marginBottom: 8 },
  items: { marginTop: 8, gap: 4 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: c.surfaceSecondary,
  },
  itemLabel: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: "auto",
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.error,
    justifyContent: "center",
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: c.error },
}));
