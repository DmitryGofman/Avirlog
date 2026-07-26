// Advanced-logging control for the classic skin — design "Option 02": a two-tone
// split bar (Ida green filling from the left, Pingala terracotta from the right)
// meeting at a vertical grip you drag. The three quick Left / Both / Right
// buttons stay above it in a compact row, so you can still log a plain state in
// one tap, or set a blend on the bar and log that instead.
//
// The grip sits at the LEFT share, so dragging it right gives Ida more of the
// bar; the hint text says so. Near-50/50 still records as Sushumna.
import { LinearGradient } from "expo-linear-gradient";
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
          <View>
            <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>LEFT · IDA</Text>
            <Text style={[styles.pct, { color: colors.stateLeft }]}>{left}%</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>RIGHT · PINGALA</Text>
            <Text style={[styles.pct, { color: colors.stateRight }]}>{right}%</Text>
          </View>
        </View>

        {/* two-tone split bar + grip */}
        <View ref={drag.ref} {...drag.panHandlers} style={styles.trackHit}>
          <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
            <View style={{ width: `${left}%`, height: "100%", backgroundColor: colors.stateLeft }} />
            <View style={{ flex: 1, height: "100%", backgroundColor: colors.stateRight }} />
            {/* soft cylinder sheen so the bar reads as a solid object */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255,255,255,0.22)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.12)"]}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={[styles.grip, { left: `${left}%`, backgroundColor: colors.surface }]}>
            <View style={[styles.ridge, { backgroundColor: colors.onSurfaceTertiary, left: 1.5 }]} />
            <View style={[styles.ridge, { backgroundColor: colors.onSurfaceTertiary, right: 1.5 }]} />
          </View>
        </View>

        <Text style={[styles.hint, { color: colors.onSurfaceTertiary }]}>
          Drag the divider — the two sides stay linked.
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

const TRACK_H = 34;
const GRIP_W = 7;

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
  pct: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -1 },
  trackHit: { height: TRACK_H, justifyContent: "center" },
  track: {
    height: TRACK_H,
    borderRadius: 10,
    overflow: "hidden",
    flexDirection: "row",
  },
  grip: {
    position: "absolute",
    top: -3,
    bottom: -3,
    width: GRIP_W,
    marginLeft: -GRIP_W / 2,
    borderRadius: 4,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  ridge: { position: "absolute", top: "38%", height: "24%", width: 1, opacity: 0.6 },
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
