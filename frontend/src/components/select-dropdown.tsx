import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/icon";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type Option = { label: string; value: string };

export function SelectDropdown({
  label,
  value,
  options,
  onChange,
  testID,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const selected = options.find((o) => o.value === value);
  const isDefault = !value || value === options[0]?.value;

  return (
    <>
      <Pressable
        style={[styles.pill, !isDefault && { borderColor: colors.brandPrimary }]}
        onPress={() => setOpen(true)}
        testID={testID}
      >
        <Text style={[styles.pillText, !isDefault && { color: colors.brand }]} numberOfLines={1}>
          {selected ? selected.label : label}
        </Text>
        <Icon name="chevron-down" size={16} color={isDefault ? colors.muted : colors.brand} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>{label}</Text>
          <ScrollView style={{ maxHeight: 360 }}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <Pressable
                  key={o.value}
                  style={styles.option}
                  onPress={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  testID={`${testID}-opt-${o.value}`}
                >
                  <Text style={[styles.optionText, active && { color: colors.brand, fontFamily: fonts.bold }]}>
                    {o.label}
                  </Text>
                  {active && <Icon name="check" size={18} color={colors.brand} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  pillText: { flex: 1, fontFamily: fonts.semibold, fontSize: 13, color: c.onSurfaceSecondary },
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
    gap: 8,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 6 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: c.onSurface, marginBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.divider,
  },
  optionText: { fontFamily: fonts.medium, fontSize: 15, color: c.onSurface },
}));
