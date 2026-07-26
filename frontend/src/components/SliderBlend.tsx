// Advanced-logging control for the classic skin — the "Refined bars" pip design:
// 20 rounded segments, Ida green filling from the left and Pingala terracotta
// from the right, a slim handle on the divider, and each side's percentage
// beside it. The three quick Left / Both / Right buttons stay above it in a
// compact row, so you can still log a plain state in one tap, or set a blend on
// the bars and log that instead.
//
// The handle sits at the LEFT share (the divider between the two colours), so
// dragging it right gives Ida more bars. One bar = 5%, which is exactly the step
// useBlendDrag snaps to. Near-50/50 still records as Sushumna.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState, stateToBlend } from "@/src/lib/blend";
import { fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

const QUICK: NostrilState[] = ["left", "both", "right"];

export function SliderBlend({
  disabled,
  onLog,
  onQuickLog,
}: {
  disabled?: boolean;
  onLog: (rightPct: number) => void;
  // Tapping one of the compact buttons logs that state directly, no blend.
  onQuickLog?: (state: NostrilState) => void;
}) {
  const { colors } = useTheme();
  const [right, setRight] = useState(50);
  const left = 100 - right;

  // The grip is the boundary between the two fills, i.e. the LEFT share.
  const drag = useBlendDrag({ axis: "horizontal", setValue: setRight, disabled, map: (f) => (1 - f) * 100 });

  const state = blendToState(right);
  const meta = STATE_META[state];
  const dominant = state === "left" ? left : state === "right" ? right : Math.max(left, right);
  const logLabel = state === "both" ? `Log · ${meta.label} · ${left} / ${right}` : `Log · ${meta.label} ${dominant}%`;

  return (
    <View style={styles.wrap}>
      {/* compact quick-log row — same three states, one tap each */}
      <View style={styles.quickRow}>
        {QUICK.map((s) => {
          const m = STATE_META[s];
          return (
            <Pressable
              key={s}
              testID={`quick-log-${s}-button`}
              onPress={() => onQuickLog?.(s)}
              disabled={disabled || !onQuickLog}
              style={({ pressed }) => [
                styles.quickBtn,
                {
                  backgroundColor: colors[m.colorKey],
                  opacity: disabled ? 0.6 : pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              <Text style={[styles.quickLabel, { color: colors[m.onColorKey] }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.blendBlock}>
        {/* end readouts */}
        <View style={styles.ends}>
          <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>LEFT · IDA</Text>
          <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>RIGHT · PINGALA</Text>
        </View>

        {/* Refined bars: BAR_COUNT rounded segments, Ida green from the left and
            Pingala terracotta from the right, with a slim handle on the divider.
            Each bar is one 5% step, which is exactly what the drag hook snaps to. */}
        <View ref={drag.ref} {...drag.panHandlers} style={styles.trackHit}>
          <View style={styles.bars}>
            {Array.from({ length: BAR_COUNT }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  { backgroundColor: i < left / STEP ? colors.stateLeft : colors.stateRight },
                ]}
              />
            ))}
          </View>
          <View style={[styles.handle, { left: `${left}%`, backgroundColor: colors.onSurface }]} />
        </View>

        {/* percentages beside each side */}
        <View style={styles.ends}>
          <Text style={[styles.pct, { color: colors.stateLeft }]}>{left}%</Text>
          <Text style={[styles.pct, { color: colors.stateRight }]}>{right}%</Text>
        </View>

        <Text style={[styles.hint, { color: colors.onSurfaceTertiary }]}>
          Drag across the bars — the two sides stay linked.
        </Text>

        <View
          testID="blend-log-button"
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => !disabled && onLog(right)}
          style={[styles.logBtn, { backgroundColor: colors.brandPrimary, opacity: disabled ? 0.6 : 1 }]}
        >
          <View style={[styles.logDot, { backgroundColor: colors[meta.colorKey] }]} />
          <Text style={[styles.logText, { color: colors.onBrandPrimary }]}>{logLabel}</Text>
        </View>
      </View>
    </View>
  );
}

// So other screens can seed a slider from a discrete state if needed.
export const seedBlend = stateToBlend;

const BAR_COUNT = 20;
const STEP = 100 / BAR_COUNT; // 5% per bar — matches the drag hook's snapping
const TRACK_H = 34;

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", gap: spacing.xl, paddingBottom: spacing.sm },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quickBtn: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: { fontFamily: fonts.semibold, fontSize: 16, letterSpacing: -0.2 },
  blendBlock: { gap: spacing.md },
  ends: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cap: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
  pct: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.5 },
  trackHit: { height: TRACK_H, justifyContent: "center" },
  bars: { flexDirection: "row", gap: 3, height: TRACK_H },
  bar: { flex: 1, height: "100%", borderRadius: 6 },
  handle: {
    position: "absolute",
    top: -5,
    bottom: -5,
    width: 3,
    marginLeft: -1.5,
    borderRadius: 2,
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
