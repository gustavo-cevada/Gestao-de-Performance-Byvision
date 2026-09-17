import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fonts } from "@/src/typography";
import { useTheme } from "@/src/theme";

type Tone = "info" | "success" | "error";
type ToastState = { message: string; tone: Tone } | null;

const ToastCtx = createContext<(message: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      setToast({ message, tone });
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setToast(null));
    },
    [opacity],
  );

  const bg =
    toast?.tone === "success" ? colors.success : toast?.tone === "error" ? colors.error : colors.surfaceInverse;
  const fg =
    toast?.tone === "success" ? colors.onSuccess : toast?.tone === "error" ? colors.onError : colors.onSurfaceInverse;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[styles.wrap, { top: insets.top + 8, opacity }]}
          testID="toast"
        >
          <View style={[styles.toast, { backgroundColor: bg }]}>
            <Text style={[styles.text, { color: fg }]}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 9999 },
  toast: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    maxWidth: 520,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  text: { fontFamily: fonts.semibold, fontSize: 13, textAlign: "center" },
});
