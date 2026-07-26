// "Ice & Fire" press feedback for the Log screen. Left washes the screen cold
// (blue grade, frost creeping in from the edges, falling snow). Right warms it
// (heat glow from below, rising embers). Both sends one calm expanding pulse
// from the center. Runs ~3s, then melts back. Purely decorative: the overlay
// never intercepts touches.
import { LinearGradient } from "expo-linear-gradient";
import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from "react-native";

import { NostrilState } from "@/src/theme/theme";

const USE_NATIVE = Platform.OS !== "web";

const SNOW_COUNT = 16;
const EMBER_COUNT = 12;
const EFFECT_MS = 1800;
const FADE_IN_MS = 400;
const FADE_OUT_MS = 900;
const PULSE_MS = 2400;
// Overall strength of the burst layer. Kept well under 1 so logging reads as a
// soft tint rather than a full-screen flash.
const INTENSITY = 0.42;

export interface IceFireEffectHandle {
  trigger: (state: NostrilState) => void;
}

interface ParticleCfg {
  progress: Animated.Value;
  x: number; // 0..1 of screen width
  delay: number;
  duration: number;
  size: number;
  sway: number; // horizontal drift in px, sign included
}

function makeParticles(count: number): ParticleCfg[] {
  return Array.from({ length: count }, () => ({
    progress: new Animated.Value(0),
    x: Math.random(),
    delay: Math.random() * 600,
    duration: 1800 + Math.random() * 1600,
    size: 3 + Math.random() * 4,
    sway: (Math.random() - 0.5) * 60,
  }));
}

export const IceFireEffect = forwardRef<IceFireEffectHandle>(function IceFireEffect(_props, ref) {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<"cold" | "warm" | "balance" | null>(null);

  const master = useRef(new Animated.Value(0)).current; // gates the whole layer
  const pulse = useRef(new Animated.Value(0)).current;
  const snow = useRef(makeParticles(SNOW_COUNT)).current;
  const embers = useRef(makeParticles(EMBER_COUNT)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useImperativeHandle(ref, () => ({
    trigger: (state: NostrilState) => {
      running.current?.stop();

      if (state === "both") {
        // Balance: a mild, even white glow washes the background while a calm
        // ring expands from the center.
        setMode("balance");
        master.setValue(0);
        pulse.setValue(0);
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }).start();
        running.current = Animated.sequence([
          Animated.timing(master, {
            toValue: 1,
            duration: FADE_IN_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: USE_NATIVE,
          }),
          Animated.delay(EFFECT_MS - FADE_IN_MS - FADE_OUT_MS),
          Animated.timing(master, {
            toValue: 0,
            duration: FADE_OUT_MS,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: USE_NATIVE,
          }),
        ]);
        running.current.start(({ finished }) => {
          if (finished) setMode(null);
        });
        return;
      }

      const particles = state === "left" ? snow : embers;
      setMode(state === "left" ? "cold" : "warm");
      pulse.setValue(0);
      master.setValue(0);

      for (const p of particles) {
        p.progress.setValue(0);
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.progress, {
            toValue: 1,
            duration: p.duration,
            easing: Easing.linear,
            useNativeDriver: USE_NATIVE,
          }),
        ]).start();
      }

      running.current = Animated.sequence([
        Animated.timing(master, {
          toValue: 1,
          duration: FADE_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.delay(EFFECT_MS - FADE_IN_MS - FADE_OUT_MS),
        Animated.timing(master, {
          toValue: 0,
          duration: FADE_OUT_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE,
        }),
      ]);
      running.current.start(({ finished }) => {
        if (finished) setMode(null);
      });
    },
  }));

  const renderParticle = (p: ParticleCfg, i: number, kind: "snow" | "ember") => {
    const falls = kind === "snow";
    const translateY = p.progress.interpolate({
      inputRange: [0, 1],
      outputRange: falls ? [-30, height + 30] : [height + 30, -60],
    });
    // Piecewise drift approximating a gentle sine sway.
    const translateX = p.progress.interpolate({
      inputRange: [0, 0.25, 0.5, 0.75, 1],
      outputRange: [0, p.sway, 0, -p.sway, 0],
    });
    const opacity = p.progress.interpolate({
      inputRange: [0, 0.08, 0.9, 1],
      outputRange: [0, 1, 1, 0],
    });
    return (
      <Animated.View
        key={`${kind}-${i}`}
        style={[
          styles.particle,
          {
            left: p.x * width,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: falls ? "#DCEEFF" : i % 2 ? "#FFA24A" : "#FF7A28",
            opacity,
            transform: [{ translateY }, { translateX }],
          },
        ]}
      />
    );
  };

  const layerOpacity = master.interpolate({ inputRange: [0, 1], outputRange: [0, INTENSITY] });
  const pulseScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 32] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.3, 0.05, 0] });

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {mode === "cold" && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: layerOpacity }]}>
          <LinearGradient
            colors={["rgba(140,190,235,0.30)", "rgba(90,140,200,0.08)", "rgba(70,110,160,0.22)"]}
            style={StyleSheet.absoluteFill}
          />
          {/* frost creeping in from every edge */}
          <LinearGradient colors={["rgba(190,225,255,0.35)", "transparent"]} style={[styles.frost, styles.frostTop]} />
          <LinearGradient colors={["transparent", "rgba(190,225,255,0.35)"]} style={[styles.frost, styles.frostBottom]} />
          <LinearGradient
            colors={["rgba(190,225,255,0.28)", "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.frostSide, styles.frostLeft]}
          />
          <LinearGradient
            colors={["transparent", "rgba(190,225,255,0.28)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.frostSide, styles.frostRight]}
          />
          {snow.map((p, i) => renderParticle(p, i, "snow"))}
        </Animated.View>
      )}

      {mode === "warm" && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: layerOpacity }]}>
          <LinearGradient
            colors={["rgba(255,170,80,0.12)", "rgba(255,130,60,0.06)", "rgba(255,110,30,0.32)"]}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", "rgba(255,110,30,0.38)"]}
            style={[styles.frost, styles.frostBottom, { height: "32%" }]}
          />
          {embers.map((p, i) => renderParticle(p, i, "ember"))}
        </Animated.View>
      )}

      {mode === "balance" && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: layerOpacity }]}>
          {/* soft even white base + a brighter band through the center */}
          <View style={[StyleSheet.absoluteFill, styles.balanceBase]} />
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.26)", "rgba(240,242,248,0.10)", "transparent"]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

      {/* The pulse must be gated by `master` like every other layer: at rest the
          pulse value is 0, which the interpolation below maps to a *visible*
          opacity, so ungated it left a small ring permanently drawn in the middle
          of the screen. Nesting multiplies the two opacities, so it now only
          appears while a burst is actually playing. */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: layerOpacity }]}>
        <Animated.View
          style={[
            styles.pulseRing,
            {
              left: width / 2 - PULSE_BASE / 2,
              top: height / 2 - PULSE_BASE / 2,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
});

const PULSE_BASE = 14;

const styles = StyleSheet.create({
  particle: { position: "absolute", top: 0 },
  balanceBase: { backgroundColor: "rgba(248,249,252,0.12)" },
  frost: { position: "absolute", left: 0, right: 0, height: "18%" },
  frostTop: { top: 0 },
  frostBottom: { bottom: 0 },
  frostSide: { position: "absolute", top: 0, bottom: 0, width: "14%" },
  frostLeft: { left: 0 },
  frostRight: { right: 0 },
  pulseRing: {
    position: "absolute",
    width: PULSE_BASE,
    height: PULSE_BASE,
    borderRadius: PULSE_BASE / 2,
    borderWidth: 1.5,
    borderColor: "rgba(220,215,235,0.9)",
  },
});
