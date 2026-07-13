import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { DEFAULT_SKIN, SkinId } from "@/src/lib/config";
import { LOCAL_SETTINGS_KEY } from "@/src/lib/localStore";
import { storage } from "@/src/utils/storage";
import { instrumentPalette, Palette, palettes } from "@/src/theme/theme";

type Mode = "light" | "dark";

interface ThemeContextType {
  mode: Mode;
  colors: Palette;
  setMode: (m: Mode) => void;
  toggle: () => void;
  // The active skin restyles the whole app (palette + tab bar + Log screen).
  // Persistence lives with the rest of the settings; this is the live value.
  skin: SkinId;
  setSkin: (s: SkinId) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "avirlog_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");
  const [skin, setSkin] = useState<SkinId>(DEFAULT_SKIN);

  useEffect(() => {
    storage.getItem<Mode>(THEME_KEY, "light").then((v) => {
      if (v === "dark") setModeState("dark");
    });
    // Initial skin comes straight from the persisted local settings blob so
    // the very first frame renders in the right style.
    storage
      .getItem<string>(LOCAL_SETTINGS_KEY, "")
      .then((raw) => {
        if (!raw) return;
        const s = (JSON.parse(raw) as { skin?: SkinId }).skin;
        if (s) setSkin(s);
      })
      .catch(() => {});
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    storage.setItem(THEME_KEY, m);
  };

  const toggle = () => setMode(mode === "light" ? "dark" : "light");

  // Instrument is a fixed paper-and-ink look, independent of light/dark mode.
  const colors = skin === "instrument" ? instrumentPalette : palettes[mode];

  return (
    <ThemeContext.Provider value={{ mode, colors, setMode, toggle, skin, setSkin }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
