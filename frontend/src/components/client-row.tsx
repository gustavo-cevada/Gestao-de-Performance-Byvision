import { Pressable, Text, View } from "react-native";

import { Icon } from "@/src/components/icon";
import { usePaceTone } from "@/src/context/config";
import { formatBRL, formatPct } from "@/src/lib/format";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type ClientItem = {
  cod_cliente: string;
  nome: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cidade: string;
  meta: number;
  faturado: number;
  pct: number | null; // atingimento mensal (faturado/meta)
  pct_ritmo: number | null; // faturado / meta_esperada_ate_hoje
  exp_frac: number; // fracao esperada (dias decorridos / total)
  gap_pct: number | null; // exp_frac - real_frac (positivo = atrasado)
  gap_valor: number | null; // meta_esperada - faturado (positivo = atrasado)
  meta_diaria_necessaria: number | null;
  at_risk?: boolean;
  risk_reason?: string | null;
};

export function ClientRow({ item, onPress }: { item: ClientItem; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const paceTone = usePaceTone();

  const hasMeta = item.meta > 0;

  // cor pelo ritmo (limiares configuráveis)
  const toneColor = paceTone(item.pct_ritmo, hasMeta);

  const realFrac = Math.max(0, Math.min(1, item.pct ?? 0));
  const expFrac = Math.max(0, Math.min(1, item.exp_frac ?? 0));
  const behind = hasMeta && (item.gap_pct ?? 0) > 0.0001;
  const deficitLeft = realFrac * 100;
  const deficitWidth = Math.max(0, (expFrac - realFrac) * 100);

  const title = (item.razao_social || item.nome_fantasia || item.nome || "").trim();
  const fantasia = (item.nome_fantasia || "").trim();
  const subtitle = fantasia && fantasia.toUpperCase() !== title.toUpperCase() ? fantasia : null;

  return (
    <Pressable style={styles.row} onPress={onPress} testID={`client-row-${item.cod_cliente}`}>
      <View style={styles.headerLine}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.badge, { backgroundColor: hasMeta ? toneColor : colors.surfaceTertiary }]}>
          <Text style={[styles.badgeText, { color: hasMeta ? colors.onBrandPrimary : colors.muted }]}>
            {hasMeta ? formatPct(item.pct_ritmo) : "s/ meta"}
          </Text>
        </View>
      </View>

      {subtitle && (
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      )}

      <Text style={styles.meta} numberOfLines={1}>
        {`#${item.cod_cliente}  •  ${item.cidade}  •  ritmo da meta`}
      </Text>

      {item.at_risk && (
        <View style={styles.riskTag}>
          <Icon name="trending-down" size={12} color={colors.error} />
          <Text style={styles.riskTagText}>Em risco de queda</Text>
        </View>
      )}

      {/* Barra: realizado + faixa de déficit até o esperado + marcador */}
      <View style={styles.barTrack}>
        {behind && (
          <View
            style={[
              styles.deficit,
              { left: `${deficitLeft}%`, width: `${deficitWidth}%`, backgroundColor: toneColor },
            ]}
          />
        )}
        <View style={[styles.barFill, { width: `${realFrac * 100}%`, backgroundColor: toneColor }]} />
        {hasMeta && <View style={[styles.marker, { left: `${expFrac * 100}%`, backgroundColor: colors.onSurface }]} />}
      </View>

      {/* Métricas */}
      <View style={styles.stats}>
        <Stat label="Faturado" value={formatBRL(item.faturado)} />
        <Stat label="Meta" value={hasMeta ? formatBRL(item.meta) : "—"} />
        <Stat
          label="Meta/dia"
          value={hasMeta && item.meta_diaria_necessaria != null ? formatBRL(item.meta_diaria_necessaria) : "—"}
        />
      </View>

      {hasMeta && (
        <View style={styles.gapLine}>
          <View style={[styles.gapChip, { backgroundColor: colors.surfaceTertiary }]}>
            <Icon
              name={behind ? "trending-down" : "trending-up"}
              size={14}
              color={behind ? toneColor : colors.success}
            />
            <Text style={[styles.gapText, { color: behind ? toneColor : colors.success }]} numberOfLines={1}>
              {behind ? "Atrasado" : "Adiantado"} {formatPct(Math.abs(item.gap_pct ?? 0))} ·{" "}
              {formatBRL(Math.abs(item.gap_valor ?? 0))}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
    </View>
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
  subtitle: { fontFamily: fonts.medium, fontSize: 11, color: c.muted, letterSpacing: 0.3, textTransform: "uppercase", marginTop: -2 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, minWidth: 52, alignItems: "center" },
  badgeText: { fontFamily: fonts.numBold, fontSize: 12 },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: c.muted },
  riskTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: c.surfaceTertiary,
    borderWidth: 1,
    borderColor: c.error,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  riskTagText: { fontFamily: fonts.semibold, fontSize: 10.5, color: c.error },

  barTrack: {
    height: 10,
    borderRadius: 3,
    backgroundColor: c.surfaceTertiary,
    overflow: "hidden",
    position: "relative",
  },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 0 },
  deficit: { position: "absolute", top: 0, bottom: 0, opacity: 0.28 },
  marker: { position: "absolute", top: -1, bottom: -1, width: 2, opacity: 0.7 },

  stats: { flexDirection: "row", gap: 8, marginTop: 2 },
  stat: { flex: 1 },
  statLabel: { fontFamily: fonts.regular, fontSize: 10, color: c.muted },
  statValue: { fontFamily: fonts.numMedium, fontSize: 13, color: c.onSurfaceSecondary },

  gapLine: { flexDirection: "row", alignItems: "center" },
  gapChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gapText: { fontFamily: fonts.semibold, fontSize: 11.5 },
}));
