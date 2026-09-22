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
  logoRight = false,
  actions = [],
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onMenu?: () => void;
  logoRight?: boolean;
  actions?: Action[];
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 18 }]} testID="app-header">
      <View style={styles.row}>
        <View style={[styles.left, logoRight && styles.leftNarrow]}>
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

        <View style={[styles.center, logoRight && styles.centerLeft]}>
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

        {logoRight ? (
          <View style={styles.rightLogoWrap}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </View>
        ) : (
          <View style={styles.actions}>
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
          </View>
        )}
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
  left: { width: 104, justifyContent: "center" },
  leftNarrow: { width: 44 },
  logo: { width: 104, height: 34 },
  backBtn: { width: 38, height: 38, justifyContent: "center", alignItems: "flex-start" },
  center: { flex: 1, alignItems: "center" },
  centerLeft: { alignItems: "flex-start", paddingLeft: 4 },
  rightLogoWrap: { width: 108, alignItems: "flex-end", justifyContent: "center" },
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
  actions: { flexDirection: "row", width: 104, justifyContent: "flex-end", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
}));
