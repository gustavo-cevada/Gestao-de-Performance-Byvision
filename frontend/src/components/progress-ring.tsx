import { View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { fonts } from "@/src/typography";
import { useTheme } from "@/src/theme";

// Dois anéis concêntricos: externo = provisionado (onde deveria estar),
// interno = realizado (onde está).
export function ProgressRing({
  realizado,
  provisionado,
  size = 168,
  stroke = 14,
}: {
  realizado: number; // fração 0..n
  provisionado: number; // fração 0..1
  size?: number;
  stroke?: number;
}) {
  const { colors } = useTheme();

  const rOuter = (size - stroke) / 2;
  const rInner = rOuter - stroke - 6;
  const cOuter = 2 * Math.PI * rOuter;
  const cInner = 2 * Math.PI * rInner;

  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const provFrac = clamp(provisionado);
  const realFrac = clamp(realizado);

  const realColor =
    realizado >= provisionado ? colors.success : realizado >= provisionado * 0.75 ? colors.warning : colors.error;

  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {/* trilhos */}
        <Circle cx={center} cy={center} r={rOuter} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        <Circle cx={center} cy={center} r={rInner} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        {/* provisionado (externo) */}
        <Circle
          cx={center}
          cy={center}
          r={rOuter}
          stroke={colors.info}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={cOuter}
          strokeDashoffset={cOuter * (1 - provFrac)}
          transform={`rotate(-90 ${center} ${center})`}
        />
        {/* realizado (interno) */}
        <Circle
          cx={center}
          cy={center}
          r={rInner}
          stroke={realColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={cInner}
          strokeDashoffset={cInner * (1 - realFrac)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontFamily: fonts.numBold, fontSize: 34, color: colors.onSurface }}>
          {`${Math.round(realizado * 100)}%`}
        </Text>
        <Text style={{ fontFamily: fonts.medium, fontSize: 11, color: colors.muted, marginTop: 2 }}>
          REALIZADO
        </Text>
      </View>
    </View>
  );
}
