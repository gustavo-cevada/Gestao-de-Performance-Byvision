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
  actions = [],
}: {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: Action[];
}) {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 10 }]} testID="app-header">
      <View style={styles.row}>
        <View style={styles.left}>
          {onBack ? (
            <Pressable onPress={onBack} style={styles.backBtn} hitSlop={10} testID="header-back">
              <Icon name="chevron-left" size={26} color={colors.onBrandPrimary} />
            </Pressable>
          ) : (
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          )}
        </View>

        <View style={styles.center}>
          {!!title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {!!subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

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
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    backgroundColor: c.brandPrimary,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  row: { flexDirection: "row", alignItems: "center", minHeight: 40 },
  left: { width: 96, justifyContent: "center" },
  logo: { width: 96, height: 30 },
  backBtn: { width: 34, height: 34, justifyContent: "center", alignItems: "flex-start" },
  center: { flex: 1, alignItems: "center" },
  title: {
    color: c.onBrandPrimary,
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  subtitle: {
    color: c.onBrandPrimary,
    opacity: 0.85,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 1,
  },
  actions: { flexDirection: "row", width: 96, justifyContent: "flex-end", gap: 6 },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
}));
