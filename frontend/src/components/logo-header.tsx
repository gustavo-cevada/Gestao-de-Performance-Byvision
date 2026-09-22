import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, IconName } from "@/src/components/icon";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

const LOGO = require("../../assets/images/byvision-logo.png");

type Action = { icon: IconName; onPress: () => void; testID?: string };

export function LogoHeader({
  title,
  subtitle,
  onBack,
  onMenu,
  actions = [],
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  actions?: Action[];
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 18 }]} testID="app-header">
      <View style={styles.row}>
        <View style={styles.left}>
          {onMenu ? (
            <Pressable onPress={onMenu} style={styles.backBtn} hitSlop={10} testID="menu-button">
              <Icon name="menu" size={26} color={colors.onBrandPrimary} />
            </Pressable>
          ) : onBack ? (
            <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10} testID="header-back">
              <Icon name="chevron-left" size={26} color={colors.onBrandPrimary} />
            </Pressable>
          ) : (
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          )}
        </View>

        <View style={styles.center}>
          {!!title && (
            <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {title}
            </Text>
          )}
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        <View style={styles.rightWrap}>
          {actions.map((a, i) => (
            <Pressable
              key={i}
              onPress={a.onPress}
              style={styles.actionBtn}
              hitSlop={8}
              testID={a.testID}
            >
              <Icon name={a.icon} size={22} color={colors.onBrandPrimary} />
            </Pressable>
          ))}
          {(onMenu || onBack) && <Image source={LOGO} style={styles.logo} contentFit="contain" />}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 16,
    paddingBottom: 22,
  },
  row: { flexDirection: "row", alignItems: "center", minHeight: 52 },
  left: { width: 44, justifyContent: "center" },
  logo: { width: 104, height: 34 },
  backBtn: { width: 38, height: 38, justifyContent: "center", alignItems: "flex-start" },
  center: { flex: 1, alignItems: "flex-start", paddingLeft: 4 },
  rightWrap: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
  title: {
    color: c.onBrandPrimary,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  subtitle: {
    color: c.onBrandPrimary,
    opacity: 0.9,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginTop: 3,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
}));
