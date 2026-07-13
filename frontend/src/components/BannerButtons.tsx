// The three banner buttons of the Living Banners design: moon-and-water for
// the left nostril, sun-and-flame for the right, and a thin eclipse banner
// between them for Both. The names are embroidered into the cloth itself
// (Left / Ida · Calming, Right / Pingala · Active, Both / Sushumna ·
// Balanced). Cloth physics = a slow sway from the rod plus a faster ripple;
// pressing kicks a wave through the fabric and glows blue / red / white.
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { NostrilState } from "@/src/theme/theme";

const USE_NATIVE = Platform.OS !== "web";

const GLOW: Record<NostrilState, string> = {
  left: "rgba(110,170,255,0.55)",
  right: "rgba(255,110,90,0.55)",
  both: "rgba(255,255,255,0.6)",
};

interface BannerProps {
  state: NostrilState;
  disabled: boolean;
  onPress: (state: NostrilState) => void;
  swayDelay: number;
  children: React.ReactNode; // the banner SVG
  thin?: boolean;
}

function Banner({ state, disabled, onPress, swayDelay, children, thin }: BannerProps) {
  const sway = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (v: Animated.Value, dur: number, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
          Animated.timing(v, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: USE_NATIVE }),
        ]),
      );
    const a = mk(sway, 3000, swayDelay);
    const b = mk(ripple, 1300, swayDelay / 2);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [sway, ripple, swayDelay]);

  const press = () => {
    wave.setValue(0);
    Animated.timing(wave, { toValue: 1, duration: 950, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }).start();
    glow.setValue(0);
    Animated.sequence([
      Animated.timing(glow, { toValue: 1, duration: 220, useNativeDriver: USE_NATIVE }),
      Animated.timing(glow, { toValue: 0, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE }),
    ]).start();
    onPress(state);
  };

  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ["-0.7deg", "0.8deg"] });
  const rippleSkew = ripple.interpolate({ inputRange: [0, 1], outputRange: ["-1.1deg", "1.6deg"] });
  const waveSkew = wave.interpolate({
    inputRange: [0, 0.14, 0.38, 0.62, 0.82, 1],
    outputRange: ["0deg", "5deg", "-4deg", "2.4deg", "-1.1deg", "0deg"],
  });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Pressable
      testID={`quick-log-${state}-button`}
      accessibilityLabel={`Log ${state === "both" ? "both nostrils" : state + " nostril"}`}
      onPress={press}
      disabled={disabled}
      style={({ pressed }) => [
        thin ? styles.thinSlot : styles.slot,
        { transform: [{ scale: pressed ? 0.96 : 1 }, { translateY: pressed ? 3 : 0 }] },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: GLOW[state], opacity: glowOpacity }]}
      />
      <Animated.View style={{ flex: 1, transform: [{ rotate }] }}>
        <Animated.View style={{ flex: 1, transform: [{ skewX: rippleSkew }, { skewX: waveSkew }] }}>
          {children}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function LeftBannerArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 146 404">
      <Defs>
        <LinearGradient id="clothL" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#3A3E6E" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#282250" stopOpacity="0.94" />
        </LinearGradient>
      </Defs>
      <Path d="M4 6 H142 V360 L73 396 L4 360 Z" fill="url(#clothL)" stroke="#8E93C4" strokeWidth="1.5" strokeOpacity="0.55" />
      <Path d="M26 6 v-6 M73 6 v-6 M120 6 v-6" stroke="#4A3018" strokeWidth="5" />
      <Path d="M14 16 H132 V354 L73 385 L14 354 Z" fill="none" stroke="#AEB2DC" strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
      <Path d="M90 60 a27 27 0 1 0 12 48 a21 21 0 1 1 -12 -48 Z" fill="#EDE8F5" opacity="0.92" />
      <Circle cx="48" cy="56" r="2" fill="#C9CFF0" opacity="0.8" />
      <Circle cx="42" cy="84" r="1.6" fill="#C9CFF0" opacity="0.6" />
      <Circle cx="104" cy="134" r="1.8" fill="#C9CFF0" opacity="0.65" />
      <Ellipse cx="46" cy="146" rx="7" ry="3.5" fill="#D9A8C9" opacity="0.75" transform="rotate(-18 46 146)" />
      {/* embroidered name */}
      <SvgText x="73" y="196" textAnchor="middle" fontSize="18" letterSpacing="3" fontWeight="600" fill="#DCE0F5" opacity="0.95">
        LEFT
      </SvgText>
      <SvgText x="73" y="216" textAnchor="middle" fontSize="8.5" letterSpacing="2.6" fill="#AEB2DC" opacity="0.9">
        IDA · CALMING
      </SvgText>
      <G fill="none" strokeLinecap="round">
        <Path d="M20 268 Q38 256 56 268 Q74 280 92 268 Q110 256 128 268" stroke="#7EA8D9" strokeWidth="5" opacity="0.8" />
        <Path d="M20 292 Q38 280 56 292 Q74 304 92 292 Q110 280 128 292" stroke="#5E7EB8" strokeWidth="5" opacity="0.65" />
        <Path d="M32 316 Q50 305 68 316 Q86 327 104 316" stroke="#4A5E98" strokeWidth="5" opacity="0.5" />
      </G>
    </Svg>
  );
}

function RightBannerArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 146 404">
      <Defs>
        <LinearGradient id="clothR" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7E4234" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#5A2824" stopOpacity="0.94" />
        </LinearGradient>
      </Defs>
      <Path d="M4 6 H142 V360 L73 396 L4 360 Z" fill="url(#clothR)" stroke="#D9A088" strokeWidth="1.5" strokeOpacity="0.55" />
      <Path d="M26 6 v-6 M73 6 v-6 M120 6 v-6" stroke="#4A3018" strokeWidth="5" />
      <Path d="M14 16 H132 V354 L73 385 L14 354 Z" fill="none" stroke="#E8B89E" strokeWidth="1" strokeDasharray="4 4" opacity="0.45" />
      <Circle cx="73" cy="82" r="23" fill="#F2E2BC" opacity="0.95" />
      <G fill="#F2E2BC" opacity="0.85">
        <Path d="M73 46 L77 57 L69 57 Z" />
        <Path d="M73 118 L77 107 L69 107 Z" />
        <Path d="M37 82 L48 78 L48 86 Z" />
        <Path d="M109 82 L98 78 L98 86 Z" />
        <Path d="M48 57 L57 62 L51 68 Z" />
        <Path d="M98 107 L89 102 L95 96 Z" />
        <Path d="M98 57 L95 68 L89 62 Z" />
        <Path d="M48 107 L51 96 L57 102 Z" />
      </G>
      <Path d="M102 60 l16 -13 M106 72 l18 -7" stroke="#E8B89E" strokeWidth="1.6" opacity="0.5" />
      <Path d="M30 148 h24 M30 160 h16" stroke="#E8B89E" strokeWidth="1.8" opacity="0.45" />
      {/* embroidered name */}
      <SvgText x="73" y="196" textAnchor="middle" fontSize="18" letterSpacing="3" fontWeight="600" fill="#F5DEC9" opacity="0.95">
        RIGHT
      </SvgText>
      <SvgText x="73" y="216" textAnchor="middle" fontSize="8.5" letterSpacing="2.2" fill="#E8B89E" opacity="0.9">
        PINGALA · ACTIVE
      </SvgText>
      <G fill="none" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M24 318 L38 282 L52 312 L68 270 L82 312 L98 280 L112 316" stroke="#E8934A" strokeWidth="5" opacity="0.8" />
        <Path d="M34 336 L50 306 L66 330 L82 300 L98 328 L110 310" stroke="#B85A32" strokeWidth="5" opacity="0.6" />
      </G>
    </Svg>
  );
}

function BothBannerArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 42 390">
      <Defs>
        <LinearGradient id="clothB" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#524E5E" stopOpacity="0.9" />
          <Stop offset="1" stopColor="#363240" stopOpacity="0.94" />
        </LinearGradient>
      </Defs>
      <Path d="M2 6 H40 V350 L21 386 L2 350 Z" fill="url(#clothB)" stroke="#C9C4D4" strokeWidth="1.2" strokeOpacity="0.5" />
      <Path d="M12 6 v-6 M30 6 v-6" stroke="#4A3018" strokeWidth="4" />
      <Path d="M8 14 H34 V344 L21 376 L8 344 Z" fill="none" stroke="#D4CFE0" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.4" />
      <Circle cx="21" cy="58" r="13" fill="#EDE8DC" opacity="0.95" />
      <Path d="M21 45 a13 13 0 0 1 0 26 Z" fill="#2E2A3E" />
      {/* embroidered name */}
      <SvgText x="21" y="96" textAnchor="middle" fontSize="9" letterSpacing="1.8" fontWeight="600" fill="#E8E4F0" opacity="0.95">
        BOTH
      </SvgText>
      <Path d="M21 112 Q15 134 21 156" stroke="#7EA8D9" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.75" />
      <Path d="M21 200 Q27 178 21 156" stroke="#E8934A" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.75" />
      <Circle cx="21" cy="156" r="4" fill="#EDE8DC" opacity="0.9" />
      <SvgText
        x="21"
        y="224"
        textAnchor="start"
        fontSize="7.5"
        letterSpacing="1.8"
        fill="#C9C4D4"
        opacity="0.9"
        transform="rotate(90 21 224)"
      >
        SUSHUMNA · BALANCED
      </SvgText>
      <Path d="M14 356 L21 342 L28 356" stroke="#C9C4D4" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
    </Svg>
  );
}

interface BannerButtonsProps {
  disabled: boolean;
  onLog: (state: NostrilState) => void;
}

export function BannerButtons({ disabled, onLog }: BannerButtonsProps) {
  return (
    <View style={styles.rig}>
      <View style={styles.rod} />
      <View style={styles.rodCapL} />
      <View style={styles.rodCapR} />
      <View style={styles.row}>
        <Banner state="left" disabled={disabled} onPress={onLog} swayDelay={0}>
          <LeftBannerArt />
        </Banner>
        <Banner state="both" disabled={disabled} onPress={onLog} swayDelay={1100} thin>
          <BothBannerArt />
        </Banner>
        <Banner state="right" disabled={disabled} onPress={onLog} swayDelay={2600}>
          <RightBannerArt />
        </Banner>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rig: { flex: 1, position: "relative", paddingTop: 8, minHeight: 320 },
  rod: {
    position: "absolute",
    top: 8,
    left: 2,
    right: 2,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#5C3D21",
  },
  rodCapL: {
    position: "absolute",
    top: 4,
    left: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#6E4A2A",
  },
  rodCapR: {
    position: "absolute",
    top: 4,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#6E4A2A",
  },
  row: { flex: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: 6 },
  slot: { width: "39%", maxWidth: 176, height: "100%", maxHeight: 500 },
  thinSlot: { width: "12%", maxWidth: 52, height: "97%", maxHeight: 484 },
  halo: {
    position: "absolute",
    top: -8,
    left: -10,
    right: -10,
    bottom: -2,
    borderRadius: 26,
  },
});
