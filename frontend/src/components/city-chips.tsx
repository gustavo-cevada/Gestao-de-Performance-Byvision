import { Pressable, ScrollView, Text } from "react-native";

import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export function CityChips({
  cities,
  selected,
  onSelect,
}: {
  cities: string[];
  selected: string;
  onSelect: (city: string) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const all = ["TODAS", ...cities];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      testID="city-chip-row"
    >
      {all.map((city) => {
        const active = city === selected;
        return (
          <Pressable
            key={city}
            onPress={() => onSelect(city)}
            style={[
              styles.chip,
              { backgroundColor: "transparent",
                borderColor: active ? colors.brand : colors.borderStrong },
            ]}
            testID={`city-chip-${city}`}
          >
            <Text
              style={[
                styles.text,
                { color: active ? colors.brand : colors.muted },
              ]}
              numberOfLines={1}
            >
              {city}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles((c) => ({
  row: { gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    height: 36,
    flexShrink: 0,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  text: { fontFamily: fonts.semibold, fontSize: 13 },
}));
