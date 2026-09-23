import { Text, View } from "react-native";

import { formatBRL, formatDateBR } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type Purchase = { data_baixa: string; valor: number; id_pedido: number | string };

export function PurchaseBars({ data, limit = 12 }: { data: Purchase[]; limit?: number }) {
  const styles = useStyles();
  const { scheme } = useTheme();

  const items = data.slice(0, limit);
  const max = Math.max(1, ...items.map((p) => Math.abs(Number(p.valor) || 0)));

  // barra e valor com a mesma cor; fundo do valor uma forma sólida clarinha
  const barColor = scheme === "dark" ? "#e6e6e6" : "#333333";
  const pillBg = scheme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.07)";

  return (
    <View style={styles.wrap}>
      {items.map((p, i) => {
        const w = Math.max(4, (Math.abs(Number(p.valor) || 0) / max) * 100);
        return (
          <View key={`${p.id_pedido}-${i}`} style={styles.item} testID={`purchase-${p.id_pedido}`}>
            <View style={styles.topLine}>
              <View style={{ flex: 1 }}>
                <Text style={styles.date}>{formatDateBR(p.data_baixa)}</Text>
                <Text style={styles.ped}>Pedido {p.id_pedido}</Text>
              </View>
              <View style={[styles.pill, { backgroundColor: pillBg }]}>
                <Text style={[styles.value, { color: barColor }]}>{formatBRL(p.valor)}</Text>
              </View>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${w}%`, backgroundColor: barColor }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: 16 },
  item: { gap: 8 },
  topLine: { flexDirection: "row", alignItems: "center", gap: 10 },
  date: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  ped: { fontFamily: fonts.regular, fontSize: 11.5, color: c.muted, marginTop: 1 },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { fontFamily: fonts.numBold, fontSize: 14 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4 },
}));
