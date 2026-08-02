// Skin-aware screen chrome. In the Instrument skin every tab becomes a
// numbered data sheet: mono kicker, big inked uppercase title, hairline rule.
// Other skins keep the original friendly Geist header. useSkinUi() hands
// screens the small style overrides (square corners, mono accents) so the
// whole app can follow the active skin without duplicating layouts.
import React, { ReactNode, useMemo } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, spacing } from "@/src/theme/theme";

export const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

// Memoized on the skin, so the returned object keeps its identity between
// renders. It used to be a fresh literal every call, which silently invalidated
// every useMemo/useCallback downstream that listed it as a dependency.
export function useSkinUi() {
  const { skin } = useTheme();
  return useMemo(() => {
    const instrument = skin === "instrument";
    return {
      instrument,
      // square corners for cards, bars and pills
      sq: instrument ? { borderRadius: 0 } : null,
      // mono accents for numbers and small labels
      mono: instrument ? { fontFamily: MONO } : null,
      monoLabel: instrument
        ? { fontFamily: MONO, letterSpacing: 1.2, textTransform: "uppercase" as const }
        : null,
    };
  }, [skin]);
}

interface ScreenHeaderProps {
  index: string; // sheet number in the instrument masthead, e.g. "02"
  title: string;
  subtitle?: string;
  topInset: number;
  above?: ReactNode; // e.g. History's back row
}

export function ScreenHeader({ index, title, subtitle, topInset, above }: ScreenHeaderProps) {
  const { colors } = useTheme();
  const { instrument } = useSkinUi();

  if (instrument) {
    return (
      <View
        style={[
          styles.iHeader,
          { paddingTop: topInset + spacing.md, borderBottomColor: colors.border },
        ]}
      >
        {above}
        <Text style={[styles.iKicker, { color: colors.onSurfaceTertiary }]}>
          AVIRLOG/01 · SHEET {index}
          {subtitle ? ` // ${subtitle.toUpperCase()}` : ""}
        </Text>
        <Text style={[styles.iTitle, { color: colors.onSurface }]}>{title.toUpperCase()}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.header, { paddingTop: topInset + spacing.lg }]}>
      {above}
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },

  iHeader: {
    paddingHorizontal: spacing.lg + 4,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  iKicker: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.5 },
  iTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.8, marginTop: 6 },
});
