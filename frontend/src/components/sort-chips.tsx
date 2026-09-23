import { Pressable, ScrollView, Text } from "react-native";

import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export const SORTS = [
  { key: "atingimento_desc", label: "Maior atingimento" },
  { key: "atingimento_asc", label: "Menor atingimento" },
  { key: "faturado_desc", label: "Mais vendido" },
  { key: "faturado_asc", label: "Menos vendido" },
];

export function SortChips({ sort, onChange }: { sort: string; onChange: (key: string) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {SORTS.map((s) => {
        const active = sort === s.key;
        return (
          <Pressable
            key={s.key}
            onPress={() => onChange(s.key)}
            style={[styles.chip, { borderColor: active ? colors.onSurface : colors.borderStrong }]}
            testID={`sort-${s.key}`}
          >
            <Text style={[styles.text, { color: active ? colors.onSurface : colors.muted }]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  row: { gap: 8, paddingVertical: 2 },
  chip: { height: 36, flexShrink: 0, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1.5, justifyContent: "center", alignItems: "center" },
  text: { fontFamily: fonts.semibold, fontSize: 13 },
}));
