// Banner-skin blend logger (design "Option 01"), built on the REAL Living
// Banners flags — the same LeftBannerArt / RightBannerArt cloth used by the tap
// buttons, unchanged. Each flag's length on the rod is that nostril's share:
// drag a banner down to lengthen it (more open) and the other shortens, so they
// always sum to 100%. Full flag design, top-anchored at the rod, no distortion.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { LeftBannerArt, RightBannerArt } from "@/src/components/BannerButtons";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState } from "@/src/lib/blend";
import { fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

// A single flag: the real cloth art, its container height driven by `share`
// (0–100). A gentle sway keeps it alive. Draggable — pull it down to open.
function BlendFlag({
  share,
  swayDelay,
  drag,
  children,
}: {
  share: number;
  swayDelay: number;
  drag: ReturnType<typeof useBlendDrag>;
  children: React.ReactNode;
}) {
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(swayDelay),
        Animated.timing(sway, { toValue: 1, duration: 2600, easing: Easing.out(Easing.sin), useNativeDriver: false }),
        Animated.timing(sway, { toValue: 0, duration: 3700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sway, swayDelay]);
  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ["-0.5deg", "0.6deg"] });

  return (
    <View ref={drag.ref} {...drag.panHandlers} style={styles.slot}>
      <Animated.View style={[styles.flag, { height: `${Math.max(6, share)}%`, transform: [{ rotate }] }]}>
        {children}
        <View style={styles.chip}>
          <Text style={styles.chipText}>{share}%</Text>
        </View>
      </Animated.View>
    </View>
  );
}

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
      <View style={styles.rig}>
        <View style={styles.rod} />
        <View style={styles.rodCapL} />
        <View style={styles.rodCapR} />
        <View style={styles.row}>
          <BlendFlag share={left} swayDelay={0} drag={leftDrag}>
            <LeftBannerArt />
          </BlendFlag>
          <BlendFlag share={right} swayDelay={1300} drag={rightDrag}>
            <RightBannerArt />
          </BlendFlag>
        </View>
      </View>

      <Text style={styles.hint}>Pull a banner down to open that side — they stay linked.</Text>

      <View
        testID="blend-log-button"
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => !disabled && onLog(right)}
        style={[styles.logBtn, { opacity: disabled ? 0.6 : 1 }]}
      >
        <View style={[styles.logDot, { backgroundColor: state === "left" ? "#8FA28A" : state === "right" ? "#C29580" : "#D9D4C4" }]} />
        <Text style={styles.logText}>
          Log · {meta.label} {right}% R
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  rig: { flex: 1, position: "relative", paddingTop: 8, minHeight: 320 },
  rod: { position: "absolute", top: 8, left: 2, right: 2, height: 9, borderRadius: 5, backgroundColor: "#5C3D21" },
  rodCapL: { position: "absolute", top: 4, left: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#6E4A2A" },
  rodCapR: { position: "absolute", top: 4, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#6E4A2A" },
  row: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 0 },
  slot: { width: "46%", maxWidth: 200, height: "100%" },
  flag: { width: "100%", position: "relative" },
  chip: {
    position: "absolute",
    bottom: 6,
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "rgba(8,10,20,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: "#F2F4FC", letterSpacing: 0.5 },
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
