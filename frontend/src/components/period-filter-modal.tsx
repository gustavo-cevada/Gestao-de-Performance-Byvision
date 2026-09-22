import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/icon";
import { businessDaysOfMonth, dayLong, monthChip, monthLabel, pad2 } from "@/src/lib/date";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export function PeriodFilterModal({
  visible,
  months,
  selectedMonth,
  selectedDay,
  refMonth,
  onApply,
  onClose,
}: {
  visible: boolean;
  months: string[];
  selectedMonth: string;
  selectedDay: string | null;
  refMonth: string;
  onApply: (month: string, day: string | null) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [monthLocal, setMonthLocal] = useState(selectedMonth);

  useEffect(() => {
    if (visible) setMonthLocal(selectedMonth);
  }, [visible, selectedMonth]);

  const monthList = months.length ? months : [refMonth];
  const days = businessDaysOfMonth(monthLocal);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="period-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID="period-modal">
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.title}>Filtrar período</Text>
          <Pressable onPress={onClose} hitSlop={10} testID="period-close">
            <Icon name="close" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <Text style={styles.section}>Mês</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {monthList.map((ym) => {
            const active = ym === monthLocal;
            return (
              <Pressable
                key={ym}
                onPress={() => setMonthLocal(ym)}
                style={[styles.chip, { backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary }]}
                testID={`month-chip-${ym}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.onBrandPrimary : colors.onSurfaceTertiary }]}>
                  {monthChip(ym)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.monthName}>{monthLabel(monthLocal)}</Text>

        <Text style={styles.section}>Dia (opcional)</Text>
        <Pressable
          onPress={() => onApply(monthLocal, null)}
          style={[
            styles.fullMonthBtn,
            { borderColor: !selectedDay && monthLocal === selectedMonth ? colors.brandPrimary : colors.border },
          ]}
          testID="full-month-btn"
        >
          <Icon name="calendar-month" size={18} color={colors.brandPrimary} />
          <Text style={styles.fullMonthText}>Mês inteiro</Text>
        </Pressable>

        <View style={styles.dayGrid}>
          {days.map((d) => {
            const ymd = `${monthLocal}-${pad2(d)}`;
            const active = ymd === selectedDay;
            return (
              <Pressable
                key={d}
                onPress={() => onApply(monthLocal, ymd)}
                style={[
                  styles.dayCell,
                  { backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary },
                ]}
                testID={`day-cell-${ymd}`}
              >
                <Text style={[styles.dayText, { color: active ? colors.onBrandPrimary : colors.onSurface }]}>
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {selectedDay && (
          <Text style={styles.hint}>Selecionado: {dayLong(selectedDay)}</Text>
        )}
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
    maxHeight: "82%",
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fonts.bold, fontSize: 18, color: c.onSurface },
  section: { fontFamily: fonts.semibold, fontSize: 13, color: c.muted, marginTop: 4 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: 16, borderRadius: 999, justifyContent: "center", alignItems: "center" },
  chipText: { fontFamily: fonts.semibold, fontSize: 13 },
  monthName: { fontFamily: fonts.bold, fontSize: 15, color: c.brand },
  fullMonthBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fullMonthText: { fontFamily: fonts.semibold, fontSize: 14, color: c.onSurface },
  dayGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dayCell: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  dayText: { fontFamily: fonts.numMedium, fontSize: 14 },
  hint: { fontFamily: fonts.medium, fontSize: 13, color: c.muted, textAlign: "center", marginTop: 4 },
}));
