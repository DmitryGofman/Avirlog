// Classic-skin blend logger (design "Option 03"): the two big Log buttons fill
// from the bottom to show how open each nostril is. Drag either button to set
// its level — the other adjusts so they always sum to 100%. A Log button below
// records the blend. Used when Advanced logging is on.
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState, stateToBlend } from "@/src/lib/blend";
import { fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

export function ClassicBlend({
  disabled,
  onLog,
}: {
  disabled?: boolean;
  onLog: (rightPct: number) => void;
}) {
  const { colors } = useTheme();
  const [right, setRight] = useState(50);
  const left = 100 - right;

  // Left button: dragging up fills it (more left). Right button: up fills it
  // (more right). Each maps its own vertical fraction to the shared right %.
  const leftDrag = useBlendDrag({ axis: "vertical", setValue: setRight, disabled, map: (f) => f * 100 });
  const rightDrag = useBlendDrag({ axis: "vertical", setValue: setRight, disabled, map: (f) => (1 - f) * 100 });

  const state = blendToState(right);
  const meta = STATE_META[state];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View
          ref={leftDrag.ref}
          {...leftDrag.panHandlers}
          style={[styles.btn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
        >
          <View style={[styles.fill, { height: `${left}%`, backgroundColor: colors.stateLeft }]} />
          <View style={styles.lbl}>
            <Text style={[styles.name, { color: colors.onStateLeft }]}>Left</Text>
            <Text style={[styles.pct, { color: colors.onStateLeft }]}>{left}%</Text>
            <Text style={[styles.sub, { color: colors.onStateLeft }]}>Ida</Text>
          </View>
        </View>

        <View
          ref={rightDrag.ref}
          {...rightDrag.panHandlers}
          style={[styles.btn, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
        >
          <View style={[styles.fill, { height: `${right}%`, backgroundColor: colors.stateRight }]} />
          <View style={styles.lbl}>
            <Text style={[styles.name, { color: colors.onStateRight }]}>Right</Text>
            <Text style={[styles.pct, { color: colors.onStateRight }]}>{right}%</Text>
            <Text style={[styles.sub, { color: colors.onStateRight }]}>Pingala</Text>
          </View>
        </View>
      </View>

      <Text style={[styles.hint, { color: colors.onSurfaceTertiary }]}>
        Drag a side up or down — they stay linked.
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

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  row: { flex: 1, flexDirection: "row", gap: spacing.md },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  fill: { position: "absolute", left: 0, right: 0, bottom: 0 },
  lbl: { alignItems: "center", gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 20, letterSpacing: -0.3 },
  pct: { fontFamily: fonts.bold, fontSize: 34, letterSpacing: -1 },
  sub: { fontFamily: fonts.medium, fontSize: 12, fontStyle: "italic", opacity: 0.8 },
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
