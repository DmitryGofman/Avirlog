import React, { createContext, ReactNode, useContext, useEffect, useState } from "react";

import { storage } from "@/src/utils/storage";
import { Palette, palettes } from "@/src/theme/theme";

type Mode = "light" | "dark";

interface ThemeContextType {
  mode: Mode;
  colors: Palette;
  setMode: (m: Mode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "avirlog_theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>("light");

  useEffect(() => {
    storage.getItem(THEME_KEY, "light").then((v) => {
      if (v === "dark") setModeState("dark");
    });
  }, []);

  const setMode = (m: Mode) => {
    setModeState(m);
    storage.setItem(THEME_KEY, m);
  };

  const toggle = () => setMode(mode === "light" ? "dark" : "light");

  return (
    <ThemeContext.Provider value={{ mode, colors: palettes[mode], setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
