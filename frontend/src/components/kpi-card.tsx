import { Text, View } from "react-native";

import { Icon, IconName } from "@/src/components/icon";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export function KpiCard({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
  testID,
}: {
  label: string;
  value: string;
  icon: IconName;
  tone?: "neutral" | "success" | "error" | "warning";
  hint?: string;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const valueColor =
    tone === "success"
      ? colors.success
      : tone === "error"
        ? colors.error
        : tone === "warning"
          ? colors.warning
          : colors.onSurface;

  const iconBg =
    tone === "success"
      ? colors.brandTertiary
      : tone === "error"
        ? "rgba(217,48,37,0.12)"
        : tone === "warning"
          ? "rgba(230,149,0,0.14)"
          : colors.surfaceTertiary;

  return (
    <View style={styles.card} testID={testID}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={18} color={valueColor} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      {!!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    flex: 1,
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 6,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontFamily: fonts.medium, fontSize: 12, color: c.muted },
  value: { fontFamily: fonts.numBold, fontSize: 19 },
  hint: { fontFamily: fonts.regular, fontSize: 11, color: c.muted },
}));
