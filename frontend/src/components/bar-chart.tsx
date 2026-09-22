import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { monthLabel } from "@/src/lib/date";
import { formatBRL } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type MonthPoint = { mes: string; valor: number };

// Gráfico de barras do faturamento mensal. Tocar numa barra mostra um
// popup com o mês e o valor.
export function BarChart({ data }: { data: MonthPoint[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <Text style={styles.empty}>Sem compras no período.</Text>;
  }

  const max = Math.max(1, ...data.map((m) => m.valor));
  const sel = selected != null ? data[selected] : null;

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.tooltip, !sel && styles.tooltipEmpty]}>
        {sel ? (
          <>
            <Text style={styles.tooltipMonth}>{monthLabel(sel.mes)}</Text>
            <Text style={styles.tooltipValue} adjustsFontSizeToFit numberOfLines={1}>
              {formatBRL(sel.valor)}
            </Text>
          </>
        ) : (
          <Text style={styles.tooltipHint}>Toque numa barra para ver o valor do mês</Text>
        )}
      </View>

      <View style={styles.chart}>
        {data.map((m, i) => {
          const active = i === selected;
          return (
            <Pressable
              key={m.mes}
              style={styles.col}
              onPress={() => setSelected(active ? null : i)}
              testID={`bar-${m.mes}`}
            >
              <View style={styles.barArea}>
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${(m.valor / max) * 100}%`,
                      backgroundColor: active ? colors.brand : colors.brandPrimary,
                      opacity: selected == null || active ? 1 : 0.45,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.label, active && { color: colors.brand, fontFamily: fonts.numBold }]}>
                {m.mes.slice(5)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  empty: { fontFamily: fonts.regular, fontSize: 13, color: c.muted },
  tooltip: {
    alignSelf: "flex-start",
    backgroundColor: c.brandTertiary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 140,
  },
  tooltipEmpty: { backgroundColor: c.surfaceTertiary },
  tooltipMonth: { fontFamily: fonts.semibold, fontSize: 12, color: c.onBrandTertiary },
  tooltipValue: { fontFamily: fonts.numBold, fontSize: 17, color: c.onBrandTertiary },
  tooltipHint: { fontFamily: fonts.regular, fontSize: 12, color: c.muted },
  chart: { flexDirection: "row", alignItems: "stretch", gap: 6, height: 140 },
  col: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 6 },
  barArea: { flex: 1, width: "68%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 4, minHeight: 3 },
  label: { fontFamily: fonts.numMedium, fontSize: 10, color: c.muted },
}));
