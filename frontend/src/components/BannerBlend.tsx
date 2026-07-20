// Banner-skin blend logger (design "Option 01"): two cloth banners hang from
// rods over the living sky. Each banner's length is that nostril's share; pull
// one longer and the other shortens (they sum to 100%). Drag a banner down to
// lengthen it, then Log. Used when Advanced logging is on with the banners skin.
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState } from "@/src/lib/blend";
import { fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

// Fixed cloth colours — the banners read against the dark sky regardless of theme.
const CLOTH_L = "#8FA28A";
const CLOTH_R = "#C29580";
const INK_L = "#172016";
const INK_R = "#2A1109";
const ROD = "#6E5F41";

export function BannerBlend({
  disabled,
  onLog,
}: {
  disabled?: boolean;
  onLog: (rightPct: number) => void;
}) {
  const [right, setRight] = useState(50);
  const left = 100 - right;

  // Pull a banner DOWN to lengthen it (more open on that side).
  const leftDrag = useBlendDrag({ axis: "vertical", setValue: setRight, disabled, map: (f) => (1 - f) * 100 });
  const rightDrag = useBlendDrag({ axis: "vertical", setValue: setRight, disabled, map: (f) => f * 100 });

  const state = blendToState(right);
  const meta = STATE_META[state];

  return (
    <View style={styles.wrap}>
      <View style={styles.poles}>
        <View style={styles.pole}>
          <View style={[styles.rod, { backgroundColor: ROD }]} />
          <View ref={leftDrag.ref} {...leftDrag.panHandlers} style={styles.track}>
            <View style={[styles.banner, { height: `${left}%`, backgroundColor: CLOTH_L }]}>
              <Text style={[styles.pct, { color: INK_L }]}>{left}%</Text>
              <Text style={[styles.name, { color: INK_L }]}>Left · Ida</Text>
            </View>
          </View>
        </View>

        <View style={styles.pole}>
          <View style={[styles.rod, { backgroundColor: ROD }]} />
          <View ref={rightDrag.ref} {...rightDrag.panHandlers} style={styles.track}>
            <View style={[styles.banner, { height: `${right}%`, backgroundColor: CLOTH_R }]}>
              <Text style={[styles.pct, { color: INK_R }]}>{right}%</Text>
              <Text style={[styles.name, { color: INK_R }]}>Right · Pingala</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.hint}>Pull a banner down to open that side.</Text>

      <View
        testID="blend-log-button"
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => !disabled && onLog(right)}
        style={[styles.logBtn, { opacity: disabled ? 0.6 : 1 }]}
      >
        <View style={[styles.logDot, { backgroundColor: state === "left" ? CLOTH_L : state === "right" ? CLOTH_R : "#D9D4C4" }]} />
        <Text style={styles.logText}>
          Log · {meta.label} {right}% R
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  poles: { flex: 1, flexDirection: "row", gap: spacing.xl, paddingHorizontal: spacing.sm },
  pole: { flex: 1, alignItems: "center" },
  rod: { width: "100%", height: 8, borderRadius: 4 },
  track: { flex: 1, width: "84%", alignItems: "stretch" },
  banner: {
    width: "100%",
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    alignItems: "center",
    paddingTop: spacing.md,
    gap: 2,
    minHeight: 54,
    overflow: "hidden",
  },
  pct: { fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5 },
  name: { fontFamily: fonts.medium, fontSize: 11, fontStyle: "italic", opacity: 0.85 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: "center",
    color: "rgba(242,244,252,0.75)",
    textShadowColor: "rgba(4,6,14,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  logBtn: {
    height: 54,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(8,10,20,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  logDot: { width: 9, height: 9, borderRadius: 5 },
  logText: { fontFamily: fonts.semibold, fontSize: 16, color: "#F2F4FC" },
});
