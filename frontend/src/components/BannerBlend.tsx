// Banner-skin blend logger (design "Option 01 · Tight Roll"), built on the REAL
// Living Banners flags — the same LeftBannerArt / RightBannerArt cloth as the
// tap buttons, unchanged and at a FIXED size. Each flag is rolled up at the rod
// and unrolls downward like a poster: its share is how far it has unrolled. The
// unrolled edge curls into a small, firm cylinder (a "tight roll") — a vertical
// cloth-gradient with dark rims, a lit crown and a crisp specular highlight, so
// it reads as the cloth wound tight rather than a flat bar. Pull one down to
// open that side; the other rolls back up, so they always sum to 100%. Used
// when Advanced logging is on.
import { LinearGradient } from "expo-linear-gradient";
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
const MIN_REVEAL = 28; // always show at least a small roll + a sliver of cloth

// The cloth art (viewBox 146×404) fits height-first, so 1 art unit = FLAG_H/404
// on screen. The banner body is full width down to artY 360, then tapers to a
// point at artY 396 — that pointed hem is what should surface as the flag fully
// unrolls, instead of being cut off flat by the roll.
const ART_SCALE = FLAG_H / 404;
const BODY_HALF = 69 * ART_SCALE; // half-width of the straight body, on screen
const TAPER_TOP = 360; // artY where the triangle hem begins
const TAPER_TIP = 396; // artY of the point

// Cylinder shading for each flag's roll: dark rim → cloth base → lit crown →
// base → dark rim, top-to-bottom. Colours are the two cloths (Ida indigo,
// Pingala terracotta) so the roll reads as that flag wound up.
const ROLL_COLORS = {
  left: ["#201B40", "#343970", "#6E73AC", "#343970", "#201B40"] as const,
  right: ["#43180F", "#7A3B2D", "#B57E64", "#7A3B2D", "#43180F"] as const,
};

function BlendFlag({
  share,
  swayDelay,
  rollColors,
  drag,
  children,
}: {
  share: number;
  swayDelay: number;
  rollColors: readonly string[];
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

  // The flat (unrolled) part grows from the pole downward; the rest of the cloth
  // is wound into a tight cylinder at the unrolled edge. At 100% the whole flag —
  // including its pointed hem — is showing and the roll is gone.
  const revealH = Math.max(MIN_REVEAL, (share / 100) * FLAG_H);
  const rolledLen = FLAG_H - revealH;

  // The roll's WIDTH tracks the cloth width at the unrolled edge. While the edge
  // is in the straight body it's full width; once it reaches the triangle hem the
  // roll narrows with the cloth, so the flag's real point surfaces at the end.
  const artY = revealH / ART_SCALE;
  const half =
    artY <= TAPER_TOP ? BODY_HALF : BODY_HALF * Math.max(0, (TAPER_TIP - artY) / (TAPER_TIP - TAPER_TOP));
  const rollW = half * 2 + 10;
  const rollLeft = FLAG_W / 2 - rollW / 2;

  // Tight, firm roll: capped radius, and never taller than it is wide near the tip.
  const r = Math.max(6, Math.min(16, rolledLen * 0.12));
  const rollH = Math.min(Math.round(r * 2), Math.round(rollW * 0.85));
  const specH = Math.max(2, rollH * 0.14);
  const showRoll = rolledLen > 2 && rollW > 8;
  const showPct = rollW >= 44;

  return (
    <View style={styles.slot}>
      <Animated.View style={{ width: FLAG_W, height: FLAG_H, transform: [{ rotate }] }}>
        {/* the unrolled portion — full-size flag, clipped from the top down */}
        <View style={[styles.reveal, { height: revealH }]}>
          <View style={{ width: FLAG_W, height: FLAG_H }}>{children}</View>
          {/* contact shadow where the cloth bends into the roll */}
          {showRoll && (
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.30)"]}
              style={styles.contact}
            />
          )}
        </View>

        {/* the tight rolled cylinder riding the unrolled edge; it narrows with the
            cloth so the pointed hem can surface at the end of the unroll */}
        {showRoll && (
          <View
            style={[
              styles.roll,
              { top: revealH, left: rollLeft, width: rollW, height: rollH, borderRadius: rollH / 2 },
            ]}
          >
            <LinearGradient
              colors={rollColors as unknown as readonly [string, string, ...string[]]}
              locations={[0, 0.26, 0.5, 0.74, 1]}
              style={[StyleSheet.absoluteFill, { borderRadius: rollH / 2 }]}
            />
            {/* crisp specular highlight — the "firm / glossy" tell */}
            <View style={[styles.rollSpec, { top: rollH * 0.24, height: specH, borderRadius: specH }]} />
            {showPct && <Text style={styles.rollPct}>{share}%</Text>}
          </View>
        )}
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
          <BlendFlag share={left} swayDelay={0} rollColors={ROLL_COLORS.left} drag={leftDrag}>
            <LeftBannerArt />
          </BlendFlag>
          <BlendFlag share={right} swayDelay={1300} rollColors={ROLL_COLORS.right} drag={rightDrag}>
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
  contact: { position: "absolute", left: 0, right: 0, bottom: 0, height: 14 },
  roll: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.42,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  rollSpec: { position: "absolute", left: "12%", right: "12%", backgroundColor: "rgba(255,255,255,0.55)" },
  rollPct: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#F6F3FA",
    letterSpacing: 0.5,
    zIndex: 2,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
