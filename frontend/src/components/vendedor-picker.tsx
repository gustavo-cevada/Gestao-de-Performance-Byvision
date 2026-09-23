import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/src/components/icon";
import { fonts } from "@/src/typography";
import { makeStyles, useTheme } from "@/src/theme";

export type VendedorOption = {
  cod_vendedor: number;
  nome: string | null;
  synced?: boolean;
  qt_clientes?: number;
};

export function VendedorPicker({
  visible,
  vendedores,
  selected,
  onSelect,
  onClose,
  onlySynced = false,
}: {
  visible: boolean;
  vendedores: VendedorOption[];
  selected: number | null;
  onSelect: (cod: number) => void;
  onClose: () => void;
  onlySynced?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const list = onlySynced ? vendedores.filter((v) => v.synced) : vendedores;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="vendedor-picker-backdrop" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} testID="vendedor-picker">
        <View style={styles.grabber} />
        <Text style={styles.title}>Selecionar vendedor</Text>
        <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
          {list.map((v) => {
            const active = v.cod_vendedor === selected;
            return (
              <Pressable
                key={v.cod_vendedor}
                style={[styles.item, active && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                onPress={() => {
                  onSelect(v.cod_vendedor);
                  onClose();
                }}
                testID={`vendedor-option-${v.cod_vendedor}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {v.nome || `Vendedor ${v.cod_vendedor}`}
                  </Text>
                  <Text style={styles.itemSub}>
                    {`#${v.cod_vendedor}${v.qt_clientes != null ? ` • ${v.qt_clientes} clientes` : ""}`}
                    {v.synced === false ? " • não sincronizado" : ""}
                  </Text>
                </View>
                {active && <Icon name="check-circle" size={20} color={colors.brandPrimary} />}
              </Pressable>
            );
          })}
          {list.length === 0 && <Text style={styles.empty}>Nenhum vendedor disponível.</Text>}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    gap: 8,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.borderStrong, marginBottom: 6 },
  title: { fontFamily: fonts.bold, fontSize: 17, color: c.onSurface, marginBottom: 6 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.surfaceSecondary,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  itemName: { fontFamily: fonts.semibold, fontSize: 15, color: c.onSurface },
  itemSub: { fontFamily: fonts.regular, fontSize: 12, color: c.muted, marginTop: 2 },
  empty: { fontFamily: fonts.regular, fontSize: 14, color: c.muted, textAlign: "center", paddingVertical: 24 },
}));
