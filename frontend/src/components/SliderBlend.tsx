// Advanced-logging control for the classic skin.
//
// The Left / Right / Both buttons keep their ORIGINAL proportions — the same
// tall pair plus a wide Both bar as in simple mode — and the blend bar is added
// underneath rather than shrinking them.
//
// The bar is the "Refined bars" design: 20 rounded segments, Ida green filling
// from the left and Pingala terracotta from the right, with a marker showing the
// right-nostril share. Dragging RIGHT grows the terracotta side and dragging
// LEFT grows the green side — the marker tracks your finger, and the colours
// meet at the left share. One bar = 5%, which is the step the drag snaps to.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState, stateToBlend } from "@/src/lib/blend";
import { fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

export function SliderBlend({
  disabled,
  onLog,
  onQuickLog,
}: {
  disabled?: boolean;
  onLog: (rightPct: number) => void;
  // Tapping a state button logs it directly, with no blend attached.
  onQuickLog?: (state: NostrilState) => void;
}) {
  const { colors } = useTheme();
  const [right, setRight] = useState(50);
  const left = 100 - right;

  // Drag right -> more Pingala (the marker follows your finger).
  const drag = useBlendDrag({ axis: "horizontal", setValue: setRight, disabled, map: (f) => f * 100 });

  const state = blendToState(right);
  const meta = STATE_META[state];
  const dominant = state === "left" ? left : state === "right" ? right : Math.max(left, right);
  const logLabel = state === "both" ? `Log · ${meta.label} · ${left} / ${right}` : `Log · ${meta.label} ${dominant}%`;

  const stateButton = (s: NostrilState, isBoth = false) => {
    const m = STATE_META[s];
    return (
      <Pressable
        key={s}
        testID={`quick-log-${s}-button`}
        onPress={() => onQuickLog?.(s)}
        disabled={disabled || !onQuickLog}
        style={({ pressed }) => [
          isBoth ? styles.bothBtn : styles.stateBtn,
          {
            backgroundColor: colors[m.colorKey],
            opacity: disabled ? 0.6 : pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Text style={[isBoth ? styles.stateLabelSmall : styles.stateLabel, { color: colors[m.onColorKey] }]}>
          {m.label}
        </Text>
        <Text style={[styles.stateSub, { color: colors[m.onColorKey], opacity: 0.75 }]}>{m.sub}</Text>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap}>
      {/* original button proportions, untouched */}
      <View style={styles.topRow}>
        {stateButton("left")}
        {stateButton("right")}
      </View>
      {stateButton("both", true)}

      {/* the blend bar, added underneath */}
      <View style={styles.blendBlock}>
        <View style={styles.ends}>
          <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>LEFT · IDA</Text>
          <Text style={[styles.cap, { color: colors.onSurfaceTertiary }]}>RIGHT · PINGALA</Text>
        </View>

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
          {/* marker for the right-nostril share — follows the drag */}
          <View style={[styles.handle, { left: `${right}%`, backgroundColor: colors.onSurface }]} />
        </View>

        <View style={styles.ends}>
          <Text style={[styles.pct, { color: colors.stateLeft }]}>{left}%</Text>
          <Text style={[styles.pct, { color: colors.stateRight }]}>{right}%</Text>
        </View>

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
const TRACK_H = 30;

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  // identical to the simple-mode layout so the buttons keep their proportions
  topRow: { flex: 1, flexDirection: "row", gap: spacing.md },
  stateBtn: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  bothBtn: {
    height: 84,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  stateLabel: { fontFamily: fonts.semibold, fontSize: 32, letterSpacing: -0.5 },
  stateLabelSmall: { fontFamily: fonts.semibold, fontSize: 21, letterSpacing: -0.5 },
  stateSub: { fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.xs, textAlign: "center" },
  blendBlock: { gap: spacing.sm },
  ends: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cap: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
  pct: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.5 },
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
  logBtn: {
    height: 54,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  logDot: { width: 9, height: 9, borderRadius: 5 },
  logText: { fontFamily: fonts.semibold, fontSize: 16 },
});
