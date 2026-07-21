// Banner-skin blend logger (design "Option 01 · Tight Roll"), built on the REAL
// Living Banners flags — the same LeftBannerArt / RightBannerArt cloth as the
// tap buttons, unchanged and at a FIXED size. Each flag hangs from cloth loops
// over the rod and unrolls downward like a poster: its share is how far it has
// unrolled. The unrolled edge winds into a small firm cylinder that shows the
// cloth's PLAIN BACK (no front print — you don't see the sun/moon on a rolled-up
// flag), shaded as a lit roll with wound seams, and it narrows into the flag's
// pointed hem at full unroll. Pull one down to open that side; the other rolls
// back up, so they always sum to 100%. Used when Advanced logging is on.
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
// point at artY 396 — that pointed hem surfaces as the flag fully unrolls.
const ART_SCALE = FLAG_H / 404;
const BODY_HALF = 69 * ART_SCALE; // half-width of the straight body, on screen
const TAPER_TOP = 360; // artY where the triangle hem begins
const TAPER_TIP = 396; // artY of the point

// The rolled part shows the PLAIN BACK of the cloth, shaded as a lit cylinder:
// dark rim → muted reverse → lit crown → reverse → dark rim, top to bottom.
const ROLL_COLORS = {
  left: ["#1F2247", "#363B6E", "#5F65A0", "#363B6E", "#1F2247"] as const,
  right: ["#3B1910", "#7C4938", "#B27E69", "#7C4938", "#3B1910"] as const,
};
// Cloth-loop colour per flag (the tab that hangs it over the rod).
const LOOP_COLORS = { left: "#343970", right: "#7A3B2D" };
// Rendered x of the three tab positions (art x 26 / 73 / 120 × ART_SCALE).
const LOOP_X = [23, 64, 105];

function BlendFlag({
  share,
  swayDelay,
  rollColors,
  loopColor,
  drag,
  children,
}: {
  share: number;
  swayDelay: number;
  rollColors: readonly string[];
  loopColor: string;
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

  // The roll's WIDTH tracks the cloth width at the unrolled edge. In the straight
  // body it's full width; once the edge reaches the triangle hem the roll narrows
  // with the cloth, so the flag's real point surfaces at the end.
  const artY = revealH / ART_SCALE;
  const half =
    artY <= TAPER_TOP ? BODY_HALF : BODY_HALF * Math.max(0, (TAPER_TIP - artY) / (TAPER_TIP - TAPER_TOP));
  const rollW = half * 2 + 10;
  const rollLeft = FLAG_W / 2 - rollW / 2;

  // Tight, firm roll: capped radius, never taller than it is wide near the tip.
  const r = Math.max(6, Math.min(16, rolledLen * 0.12));
  const rollH = Math.min(Math.round(r * 2), Math.round(rollW * 0.85));
  const specH = Math.max(2, rollH * 0.14);
  const showRoll = rolledLen > 2 && rollW > 8;
  const showPct = rollW >= 44;
  const showSeams = showRoll && rollH >= 15;

  return (
    <View style={styles.slot}>
      <Animated.View style={{ width: FLAG_W, height: FLAG_H, transform: [{ rotate }] }}>
        {/* cloth loops that hang the banner over the rod, in its own colour */}
        {LOOP_X.map((x, i) => (
          <View key={i} style={[styles.loop, { left: x - 6.5, backgroundColor: loopColor }]} />
        ))}

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

        {/* the tight rolled cylinder — plain back of the cloth, narrowing with the
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
            {/* wound seams — a couple of overlap lines so it reads as rolled cloth */}
            {showSeams && <View style={[styles.rollSeam, { top: rollH * 0.4 }]} />}
            {showSeams && <View style={[styles.rollSeam, { top: rollH * 0.63 }]} />}
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

  // The button reads the DOMINANT banner and its own share (matches the tall
  // flag), so the number always belongs to the banner you're looking at.
  const dominant = state === "left" ? left : state === "right" ? right : Math.max(left, right);
  const dotColor = state === "left" ? "#8FA28A" : state === "right" ? "#C29580" : "#D9D4C4";
  const logLabel = state === "both" ? `Log · ${meta.label} · ${left} / ${right}` : `Log · ${meta.label} ${dominant}%`;

  return (
    <View style={styles.wrap}>
      <View style={styles.rig}>
        <View style={styles.rod} />
        <View style={styles.rodCapL} />
        <View style={styles.rodCapR} />
        <View style={styles.row}>
          <BlendFlag share={left} swayDelay={0} rollColors={ROLL_COLORS.left} loopColor={LOOP_COLORS.left} drag={leftDrag}>
            <LeftBannerArt />
          </BlendFlag>
          <BlendFlag share={right} swayDelay={1300} rollColors={ROLL_COLORS.right} loopColor={LOOP_COLORS.right} drag={rightDrag}>
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
        <View style={[styles.logDot, { backgroundColor: dotColor }]} />
        <Text style={styles.logText}>{logLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  rig: { flex: 1, position: "relative", paddingTop: 8, minHeight: FLAG_H + 20 },
  rod: { position: "absolute", top: 8, left: 2, right: 2, height: 9, borderRadius: 5, backgroundColor: "#5C3D21", zIndex: 3 },
  rodCapL: { position: "absolute", top: 4, left: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#6E4A2A", zIndex: 3 },
  rodCapR: { position: "absolute", top: 4, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: "#6E4A2A", zIndex: 3 },
  row: { flex: 1, flexDirection: "row", justifyContent: "space-evenly", alignItems: "flex-start", paddingTop: 12, zIndex: 1 },
  slot: { width: FLAG_W, height: FLAG_H, position: "relative" },
  loop: {
    position: "absolute",
    top: -12,
    width: 13,
    height: 22,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
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
  rollSeam: { position: "absolute", left: "8%", right: "8%", height: 1, backgroundColor: "rgba(0,0,0,0.20)" },
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
