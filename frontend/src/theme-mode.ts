import { useCallback, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import { setColorScheme } from "@/src/theme";

export type Mode = "light" | "dark" | "system";
const KEY = "byvision.color_mode";

export function applyMode(mode: Mode) {
  setColorScheme(mode === "system" ? null : mode);
}

export async function loadStoredMode(): Promise<Mode> {
  const m = await storage.getItem<Mode>(KEY, "light");
  return (m ?? "light") as Mode;
}

// Hook used by the settings screen to read + change the mode.
export function useColorMode() {
  const [mode, setMode] = useState<Mode>("light");

  useEffect(() => {
    loadStoredMode().then(setMode);
  }, []);

  const change = useCallback(async (next: Mode) => {
    setMode(next);
    applyMode(next);
    await storage.setItem(KEY, next);
  }, []);

  return { mode, change };
}
