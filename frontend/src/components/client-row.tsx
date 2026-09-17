import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/icon";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type ClientItem = {
  cod_cliente: string;
  nome: string;
  cidade: string;
  meta: number;
  faturado: number;
  pct: number | null;
};

export function ClientRow({ item, onPress }: { item: ClientItem; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();

  const hasMeta = item.meta > 0;
  const pct = item.pct ?? 0;
  const fillFrac = Math.max(0, Math.min(1, pct));
  const barColor = !hasMeta
    ? colors.borderStrong
    : pct >= 1
      ? colors.success
      : pct >= 0.7
        ? colors.warning
        : colors.error;

  return (
    <Pressable style={styles.row} onPress={onPress} testID={`client-row-${item.cod_cliente}`}>
      <View style={styles.headerLine}>
        <Text style={styles.name} numberOfLines={1}>
          {item.nome}
        </Text>
        <View style={[styles.badge, { backgroundColor: hasMeta ? barColor : colors.surfaceTertiary }]}>
          <Text style={[styles.badgeText, { color: hasMeta ? colors.onBrandPrimary : colors.muted }]}>
            {hasMeta ? formatPct(item.pct) : "s/ meta"}
          </Text>
        </View>
      </View>

      <Text style={styles.meta} numberOfLines={1}>
        {`#${item.cod_cliente}  •  ${item.cidade}`}
      </Text>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${fillFrac * 100}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLabel}>
          Fat. <Text style={styles.footerValue}>{formatBRL(item.faturado)}</Text>
        </Text>
        <Text style={styles.footerLabel}>
          Meta <Text style={styles.footerValue}>{hasMeta ? formatBRL(item.meta) : "—"}</Text>
        </Text>
        <Icon name="chevron-right" size={18} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    backgroundColor: c.surfaceSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
    gap: 8,
  },
  headerLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, minWidth: 46, alignItems: "center" },
  badgeText: { fontFamily: fonts.numBold, fontSize: 12 },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  barTrack: { height: 8, borderRadius: 999, backgroundColor: c.surfaceTertiary, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 999 },
  footer: { flexDirection: "row", alignItems: "center", gap: 16 },
  footerLabel: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  footerValue: { fontFamily: fonts.numMedium, fontSize: 12, color: c.onSurfaceSecondary },
}));
