// Design tokens + tema (claro/escuro) via Context confiável.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { StyleSheet, useColorScheme } from "react-native";

import { storage } from "@/src/utils/storage";

export type ColorScheme = "light" | "dark";
export type ThemeMode = "light" | "dark" | "system";

const light = {
  surface: "#ffffff",
  onSurface: "#111111",
  surfaceSecondary: "#f8f8f8",
  onSurfaceSecondary: "#222222",
  surfaceTertiary: "#eaeaea",
  onSurfaceTertiary: "#444444",
  surfaceInverse: "#1a1a1a",
  onSurfaceInverse: "#ffffff",
  muted: "#757575",

  brand: "#00aa79",
  onBrand: "#ffffff",
  brandPrimary: "#00aa79",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#008a62",
  onBrandSecondary: "#ffffff",
  brandTertiary: "#e5f7f2",
  onBrandTertiary: "#00aa79",

  success: "#00aa79",
  onSuccess: "#ffffff",
  warning: "#e69500",
  onWarning: "#ffffff",
  error: "#d93025",
  onError: "#ffffff",
  info: "#444444",
  onInfo: "#ffffff",

  border: "#e5e5e5",
  borderStrong: "#cccccc",
  divider: "#f0f0f0",
};

const dark: typeof light = {
  surface: "#121212",
  onSurface: "#f5f5f5",
  surfaceSecondary: "#1e1e1e",
  onSurfaceSecondary: "#e0e0e0",
  surfaceTertiary: "#2c2c2c",
  onSurfaceTertiary: "#cccccc",
  surfaceInverse: "#ffffff",
  onSurfaceInverse: "#121212",
  muted: "#9a9a9a",

  brand: "#00c48d",
  onBrand: "#00231a",
  brandPrimary: "#00aa79",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#00c48d",
  onBrandSecondary: "#111111",
  brandTertiary: "#0d3a2e",
  onBrandTertiary: "#4fd1a5",

  success: "#2ee0a6",
  onSuccess: "#00231a",
  warning: "#ffb74d",
  onWarning: "#111111",
  error: "#ff5c5c",
  onError: "#ffffff",
  info: "#e0e0e0",
  onInfo: "#121212",

  border: "#333333",
  borderStrong: "#555555",
  divider: "#262626",
};

export type ThemeColors = typeof light;
export const defaultScheme = "light" satisfies ColorScheme;
export const themes: { light: ThemeColors; dark: ThemeColors } = { light, dark };

const MODE_KEY = "byvision.color_mode";

type ThemeCtx = {
  scheme: ColorScheme;
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  ready: boolean;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const device = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    storage.getItem<ThemeMode>(MODE_KEY, "light").then((m) => {
      setModeState((m as ThemeMode) || "light");
      setReady(true);
    });
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(MODE_KEY, m);
  }, []);

  const scheme: ColorScheme = mode === "system" ? (device === "dark" ? "dark" : "light") : mode;
  const colors = themes[scheme] ?? themes.light;

  const value = useMemo<ThemeCtx>(
    () => ({ scheme, colors, mode, setMode, ready }),
    [scheme, colors, mode, setMode, ready],
  );

  return React.createElement(Ctx.Provider, { value }, children);
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const c = useContext(Ctx);
  if (!c) return { scheme: defaultScheme, colors: themes.light };
  return { scheme: c.scheme, colors: c.colors };
}

export function useThemeMode(): { mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const c = useContext(Ctx);
  if (!c) return { mode: "light", setMode: () => {} };
  return { mode: c.mode, setMode: c.setMode };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
