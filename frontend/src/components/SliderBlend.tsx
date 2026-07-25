// Advanced-logging blend slider — Design 01: a gradient track (Ida green →
// neutral → Pingala terra) with a round knob you drag to set how open each
// nostril is. Left % = 100 − right; the drag hook snaps to the nearest 5, and
// near-50/50 records as Sushumna. A Log button below commits the blend. Used
// for the classic skin when Advanced logging is on.
import { LinearGradient } from "expo-linear-gradient";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState, stateToBlend } from "@/src/lib/blend";
import { fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

export function SliderBlend({
  disabled,
  onLog,
}: {
  disabled?: boolean;
  onLog: (rightPct: number) => void;
}) {
  const { colors } = useTheme();
  const [right, setRight] = useState(50);
  const left = 100 - right;

  // Knob position along the track is the RIGHT share directly: far left = all
  // Ida, far right = all Pingala.
  const drag = useBlendDrag({ axis: "horizontal", setValue: setRight, disabled, map: (f) => f * 100 });

  const state = blendToState(right);
  const meta = STATE_META[state];

  return (
    <View style={styles.wrap}>
      {/* end readouts — the two shares live at the ends they belong to */}
      <View style={styles.ends}>
        <View style={styles.end}>
          <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>LEFT · IDA</Text>
          <Text style={[styles.pct, { color: colors.stateLeft }]}>{left}%</Text>
        </View>
        <View style={[styles.end, styles.endR]}>
          <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>RIGHT · PINGALA</Text>
          <Text style={[styles.pct, { color: colors.stateRight }]}>{right}%</Text>
        </View>
      </View>

      {/* gradient track + round knob */}
      <View ref={drag.ref} {...drag.panHandlers} style={styles.trackHit}>
        <LinearGradient
          colors={[colors.stateLeft, colors.surfaceTertiary, colors.stateRight]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.track}
        />
        <View
          style={[
            styles.knob,
            { left: `${right}%`, backgroundColor: colors.surface, borderColor: colors.stateRight },
          ]}
        />
      </View>

      <Text style={[styles.hint, { color: colors.onSurfaceTertiary }]}>
        Drag the knob — Left and Right stay linked.
      </Text>

      <View
        testID="blend-log-button"
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => !disabled && onLog(right)}
        style={[styles.logBtn, { backgroundColor: colors.brandPrimary, opacity: disabled ? 0.6 : 1 }]}
      >
        <View style={[styles.logDot, { backgroundColor: colors[meta.colorKey] }]} />
        <Text style={[styles.logText, { color: colors.onBrandPrimary }]}>
          Log · {meta.label} {right}% R
        </Text>
      </View>
    </View>
  );
}

// So other screens can seed a slider from a discrete state if needed.
export const seedBlend = stateToBlend;

const KNOB = 28;

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", gap: spacing.lg, paddingBottom: spacing.sm },
  ends: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  end: { gap: 2 },
  endR: { alignItems: "flex-end" },
  cap: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
  pct: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -1 },
  trackHit: { height: KNOB, justifyContent: "center" },
  track: { height: 24, borderRadius: 12, width: "100%" },
  knob: {
    position: "absolute",
    top: 0,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    marginLeft: -KNOB / 2,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  hint: { fontFamily: fonts.regular, fontSize: 12, textAlign: "center" },
  logBtn: {
    height: 54,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  logDot: { width: 9, height: 9, borderRadius: 5 },
  logText: { fontFamily: fonts.semibold, fontSize: 16 },
});
