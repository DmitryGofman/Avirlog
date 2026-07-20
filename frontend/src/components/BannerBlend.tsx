// Banner-skin blend logger (design "Option 01"), built on the REAL Living
// Banners flags — the same LeftBannerArt / RightBannerArt cloth as the tap
// buttons, unchanged and at a FIXED size. Each flag is rolled up at the rod and
// unrolls downward like a poster: its share is how far it has unrolled (a roll
// bar rides the unrolled edge). Pull one down to open that side; the other rolls
// back up, so they always sum to 100%. Used when Advanced logging is on.
import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { LeftBannerArt, RightBannerArt } from "@/src/components/BannerButtons";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState } from "@/src/lib/blend";
import { fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

// Fixed flag geometry — the cloth never changes size, it only unrolls. The box
// matches the art's 146×404 aspect so the full flag fills it at 100%.
const FLAG_W = 128;
const FLAG_H = 352;
const ROLL_H = 18;
const MIN_REVEAL = ROLL_H + 10; // always show at least the roll + a sliver

function BlendFlag({
  share,
  swayDelay,
  rollColor,
  drag,
  children,
}: {
  share: number;
  swayDelay: number;
  rollColor: string;
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

  const revealH = Math.max(MIN_REVEAL, (share / 100) * FLAG_H);

  return (
    <View style={styles.slot}>
      <Animated.View style={{ width: FLAG_W, height: FLAG_H, transform: [{ rotate }] }}>
        {/* the unrolled portion — full-size flag, clipped from the top down */}
        <View style={[styles.reveal, { height: revealH }]}>
          <View style={{ width: FLAG_W, height: FLAG_H }}>{children}</View>
        </View>
        {/* the roll riding the unrolled edge, carrying the % */}
        <View style={[styles.roll, { top: revealH - ROLL_H, backgroundColor: rollColor }]}>
          <View style={styles.rollHi} />
          <Text style={styles.rollPct}>{share}%</Text>
        </View>
      </Animated.View>
      {/* full-height transparent drag surface so you can grab anywhere */}
      <View ref={drag.ref} {...drag.panHandlers} style={styles.hit} />
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

  // Pull a banner DOWN to unroll it (more open on that side).
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
          <BlendFlag share={left} swayDelay={0} rollColor="#2B2550" drag={leftDrag}>
            <LeftBannerArt />
          </BlendFlag>
          <BlendFlag share={right} swayDelay={1300} rollColor="#5A2824" drag={rightDrag}>
            <RightBannerArt />
          </BlendFlag>
        </View>
      </View>

      <Text style={styles.hint}>Unroll a banner down the pole to open that side — they stay linked.</Text>

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
  rig: { flex: 1, position: "relative", paddingTop: 8, minHeight: FLAG_H + 20 },
  rod: { position: "absolute", top: 8, left: 2, right: 2, height: 9, borderRadius: 5, backgroundColor: "#5C3D21" },
  rodCapL: { position: "absolute", top: 4, left: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#6E4A2A" },
  rodCapR: { position: "absolute", top: 4, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#6E4A2A" },
  row: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start", paddingTop: 12 },
  slot: { width: FLAG_W, height: FLAG_H, position: "relative" },
  reveal: { width: FLAG_W, overflow: "hidden", position: "absolute", top: 0, left: 0 },
  roll: {
    position: "absolute",
    left: -4,
    width: FLAG_W + 8,
    height: ROLL_H,
    borderRadius: ROLL_H / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  rollHi: {
    position: "absolute",
    top: 3,
    left: 10,
    right: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  rollPct: { fontFamily: fonts.bold, fontSize: 12, color: "#F2F4FC", letterSpacing: 0.5 },
  hit: { ...StyleSheet.absoluteFillObject },
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
