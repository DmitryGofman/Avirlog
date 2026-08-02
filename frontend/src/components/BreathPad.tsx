// Advanced logging, second form: the breath pad.
//
// One thumb on a two-axis field. Left–right sets the BALANCE between the
// nostrils (the same 0–100 right-share the blend controls use); up–down sets
// how open the dominant side is, from fully open at the top to blocked at the
// bottom. The two per-side numbers are always shown live, so the abstraction
// never hides the data: a congested 30% / 40% morning reads exactly as that.
//
// Storage: the pad logs left_open / right_open (0–100 each, independent), plus
// the usual `blend` (the balance), so every existing chart and stat keeps
// working unchanged on pad logs. Both axes snap to 5% with a detent tick, like
// the other blend controls.
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { hapticTick } from "@/src/lib/haptics";
import { blendToState } from "@/src/lib/blend";
import { fonts, radius, spacing, STATE_META } from "@/src/theme/theme";

export interface BreathPadLog {
  blend: number; // right-nostril share of the balance, 0–100
  left_open: number; // how open the left nostril is, 0–100
  right_open: number; // how open the right nostril is, 0–100
}

const snap5 = (v: number) => Math.max(0, Math.min(100, Math.round(v / 5) * 5));

// The dominant side is exactly as open as the airflow axis says; the other
// side scales down with the balance. At even balance both sides match.
function sidesFrom(balance: number, airflow: number): { left: number; right: number } {
  return {
    left: snap5((airflow * Math.min(50, 100 - balance)) / 50),
    right: snap5((airflow * Math.min(50, balance)) / 50),
  };
}

export function BreathPad({
  disabled,
  onLog,
  // Restyles the card for the Living Banners scene (light text on dark glass).
  onScene,
}: {
  disabled?: boolean;
  onLog: (log: BreathPadLog) => void;
  onScene?: boolean;
}) {
  const { colors } = useTheme();
  const [balance, setBalance] = useState(50); // right share, 0–100
  const [airflow, setAirflow] = useState(100); // 100 = fully open, 0 = blocked

  const padRef = useRef<View>(null);
  // Latest values for the (stable) responder, so it never reads stale closures.
  const latest = useRef({ disabled });
  latest.current = { disabled };
  const box = useRef({ x: 0, y: 0, w: 1, h: 1 });
  const lastTick = useRef<string | null>(null);

  const responder = useMemo(() => {
    const emit = (pageX: number, pageY: number) => {
      const b = box.current;
      const bal = snap5(((pageX - b.x) / b.w) * 100);
      const air = snap5(100 - ((pageY - b.y) / b.h) * 100);
      const key = `${bal}/${air}`;
      if (lastTick.current !== key) {
        lastTick.current = key;
        hapticTick();
      }
      setBalance(bal);
      setAirflow(air);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !latest.current.disabled,
      onMoveShouldSetPanResponder: () => !latest.current.disabled,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        // Touch down always ticks, even on the current value.
        lastTick.current = null;
        const { pageX, pageY } = evt.nativeEvent;
        padRef.current?.measure((_x, _y, w, h, px, py) => {
          box.current = { x: px, y: py, w: w || 1, h: h || 1 };
          emit(pageX, pageY);
        });
      },
      onPanResponderMove: (evt) => emit(evt.nativeEvent.pageX, evt.nativeEvent.pageY),
    });
  }, []);

  const { left, right } = sidesFrom(balance, airflow);
  const state = blendToState(balance);
  const meta = STATE_META[state];

  const dim = onScene ? "rgba(242,244,252,0.65)" : colors.onSurfaceTertiary;
  const strong = onScene ? "#F2F4FC" : colors.onSurface;
  const grid = onScene ? "rgba(255,255,255,0.14)" : colors.border;
  const padBg = onScene ? "rgba(8,10,20,0.5)" : colors.surfaceSecondary;

  return (
    <View style={styles.wrap}>
      {/* live per-side numbers — the ground truth the pad is setting */}
      <View style={styles.readout}>
        <View>
          <Text style={[styles.cap, { color: dim }]}>LEFT · IDA</Text>
          <Text style={[styles.pct, { color: colors.stateLeft }]}>{left}%</Text>
        </View>
        <Text style={[styles.hint, { color: dim }]}>open ↑{"\n"}blocked ↓</Text>
        <View style={styles.readRight}>
          <Text style={[styles.cap, { color: dim }]}>RIGHT · PINGALA</Text>
          <Text style={[styles.pct, { color: colors.stateRight }]}>{right}%</Text>
        </View>
      </View>

      <View
        ref={padRef}
        testID="breath-pad"
        {...responder.panHandlers}
        style={[styles.pad, { backgroundColor: padBg, borderColor: grid, opacity: disabled ? 0.6 : 1 }]}
      >
        {/* side tints, so which half is which needs no reading */}
        <View style={[styles.half, styles.leftHalf, { backgroundColor: colors.stateLeft }]} />
        <View style={[styles.half, styles.rightHalf, { backgroundColor: colors.stateRight }]} />
        {/* centre balance line + airflow quarter lines */}
        <View style={[styles.vLine, { backgroundColor: grid }]} />
        {[25, 50, 75].map((y) => (
          <View key={y} style={[styles.hLine, { top: `${y}%`, backgroundColor: grid }]} />
        ))}
        {/* the thumb */}
        <View style={[styles.thumbSpot, { left: `${balance}%`, top: `${100 - airflow}%` }]}>
          <View style={[styles.thumb, { backgroundColor: strong, borderColor: colors[meta.colorKey] }]} />
        </View>
      </View>

      <View
        testID="breath-pad-log-button"
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => !disabled && onLog({ blend: balance, left_open: left, right_open: right })}
        style={[styles.logBtn, { backgroundColor: colors.brandPrimary, opacity: disabled ? 0.6 : 1 }]}
      >
        <View style={[styles.logDot, { backgroundColor: colors[meta.colorKey] }]} />
        <Text style={[styles.logText, { color: colors.onBrandPrimary }]}>
          Log · {meta.label} · L {left}% / R {right}%
        </Text>
      </View>
    </View>
  );
}

const THUMB = 30;

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  readout: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  readRight: { alignItems: "flex-end" },
  cap: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1 },
  pct: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.5 },
  hint: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 14, textAlign: "center" },
  pad: {
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  half: { position: "absolute", top: 0, bottom: 0, width: "50%", opacity: 0.16 },
  leftHalf: { left: 0 },
  rightHalf: { right: 0 },
  vLine: { position: "absolute", left: "50%", top: 0, bottom: 0, width: 1 },
  hLine: { position: "absolute", left: 0, right: 0, height: 1 },
  // A zero-size anchor at the value point, so the thumb centres on it without
  // percentage-margin tricks.
  thumbSpot: { position: "absolute", width: 0, height: 0, alignItems: "center", justifyContent: "center" },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 4,
  },
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
