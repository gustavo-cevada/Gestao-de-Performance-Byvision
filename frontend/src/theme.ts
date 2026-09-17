// Design tokens for Gestão de Performance de Vendas Byvision.
// Light + Dark. Keys match /app/design_guidelines.json "color" / "color_dark".
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

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
  muted: "#999999",

  brand: "#00aa79",
  onBrand: "#ffffff",
  brandPrimary: "#00aa79",
  onBrandPrimary: "#ffffff",
  brandSecondary: "#00c48d",
  onBrandSecondary: "#111111",
  brandTertiary: "#003324",
  onBrandTertiary: "#00c48d",

  success: "#00c48d",
  onSuccess: "#00231a",
  warning: "#ffb74d",
  onWarning: "#111111",
  error: "#ff5252",
  onError: "#ffffff",
  info: "#e0e0e0",
  onInfo: "#121212",

  border: "#333333",
  borderStrong: "#555555",
  divider: "#222222",
};

export type ThemeColors = typeof light;

export const defaultScheme = "light" satisfies ColorScheme;

export const themes: { light: ThemeColors; dark?: ThemeColors } = { light, dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme ?? "unspecified");
}

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system && themes[system] ? system : defaultScheme;
  return { scheme, colors: themes[scheme] ?? themes.light };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors } = useTheme();
    return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
  };
}
