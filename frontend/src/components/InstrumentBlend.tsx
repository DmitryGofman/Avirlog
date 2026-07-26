// Instrument-skin blend logger: a spare horizontal slider in the record-sheet
// language — hairlines, mono type, squared edges. The handle's position on the
// scale is the RIGHT nostril's share (left = right end → 100% R). Drag, then LOG.
// Used when Advanced logging is on with the instrument skin.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MONO } from "@/src/components/ScreenHeader";
import { useTheme } from "@/src/context/ThemeContext";
import { useBlendDrag } from "@/src/hooks/use-blend-drag";
import { blendToState } from "@/src/lib/blend";
import { NostrilState, spacing, STATE_META } from "@/src/theme/theme";

// Quick-log row order: Both sits between the two sides, as everywhere else.
const QUICK: NostrilState[] = ["left", "both", "right"];

export function InstrumentBlend({
  disabled,
  onLog,
  onQuickLog,
}: {
  disabled?: boolean;
  onLog: (rightPct: number) => void;
  // Tapping one of the compact buttons logs that state directly, no blend.
  onQuickLog?: (state: NostrilState) => void;
}) {
  const { colors } = useTheme();
  const [right, setRight] = useState(50);
  const left = 100 - right;

  // Position on the scale = right share. Slide right → more right.
  const drag = useBlendDrag({ axis: "horizontal", setValue: setRight, disabled, map: (f) => f * 100 });
  const state = blendToState(right);
  const stateLabel = state === "left" ? "IDA" : state === "right" ? "PINGALA" : "SUSHUMNA";

  return (
    <View style={styles.wrap}>
      <View>
        <Text style={[styles.kicker, { color: colors.onSurfaceTertiary }]}>
          AVIRLOG / 01 · SHEET 01 // BLEND
        </Text>
        <Text style={[styles.title, { color: colors.onSurface }]}>NASAL AIRFLOW</Text>
        <View style={[styles.hair, { backgroundColor: colors.border }]} />
      </View>

      {/* compact quick-log row — one tap logs a plain state, in sheet language */}
      <View style={styles.quickRow}>
        {QUICK.map((s) => (
          <Pressable
            key={s}
            testID={`quick-log-${s}-button`}
            onPress={() => onQuickLog?.(s)}
            disabled={disabled || !onQuickLog}
            style={({ pressed }) => [
              styles.quickBtn,
              {
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceTertiary : colors.surface,
                opacity: disabled ? 0.6 : 1,
              },
            ]}
          >
            <Text style={[styles.quickLabel, { color: colors.onSurface }]}>
              {STATE_META[s].label.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.readout}>
        <View>
          <Text style={[styles.rlabel, { color: colors.onSurfaceTertiary }]}>LEFT / IDA</Text>
          <Text style={[styles.rval, { color: colors.onSurface }]}>{left}%</Text>
        </View>
        <View style={styles.rcenter}>
          <Text style={[styles.rlabel, { color: colors.onSurfaceTertiary }]}>STATE</Text>
          <Text style={[styles.rstate, { color: colors.onSurface }]}>{stateLabel}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.rlabel, { color: colors.onSurfaceTertiary }]}>RIGHT / PINGALA</Text>
          <Text style={[styles.rval, { color: colors.onSurface }]}>{right}%</Text>
        </View>
      </View>

      <View style={styles.sliderArea}>
        <View ref={drag.ref} {...drag.panHandlers} style={styles.hit}>
          <View style={[styles.track, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}>
            <View style={[styles.fill, { width: `${right}%`, backgroundColor: colors.stateRight }]} />
            {[25, 50, 75].map((t) => (
              <View key={t} style={[styles.tick, { left: `${t}%`, backgroundColor: colors.border }]} />
            ))}
            <View style={[styles.thumb, { left: `${right}%`, backgroundColor: colors.onSurface, borderColor: colors.surface }]} />
          </View>
        </View>
        <View style={styles.ends}>
          <Text style={[styles.end, { color: colors.onSurfaceTertiary }]}>L</Text>
          <Text style={[styles.end, { color: colors.onSurfaceTertiary }]}>BALANCED</Text>
          <Text style={[styles.end, { color: colors.onSurfaceTertiary }]}>R</Text>
        </View>
      </View>

      <View
        testID="blend-log-button"
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => !disabled && onLog(right)}
        style={[styles.logBtn, { backgroundColor: colors.onSurface, opacity: disabled ? 0.6 : 1 }]}
      >
        <Text style={[styles.logText, { color: colors.surface }]}>LOG BLEND · R {right}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: spacing.xl, gap: spacing.xl },
  kicker: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.5 },
  title: { fontFamily: MONO, fontSize: 24, letterSpacing: 1, marginTop: 6, fontWeight: "700" },
  hair: { height: 1, marginTop: spacing.md },
  quickRow: { flexDirection: "row", gap: spacing.sm },
  quickBtn: { flex: 1, height: 46, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontFamily: MONO, fontSize: 12, fontWeight: "700", letterSpacing: 1.5 },
  readout: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  rcenter: { alignItems: "center" },
  rlabel: { fontFamily: MONO, fontSize: 9, letterSpacing: 1 },
  rval: { fontFamily: MONO, fontSize: 30, fontWeight: "700", letterSpacing: -1, marginTop: 4 },
  rstate: { fontFamily: MONO, fontSize: 15, fontWeight: "700", letterSpacing: 1, marginTop: 10 },
  sliderArea: { gap: spacing.sm },
  hit: { paddingVertical: spacing.lg, justifyContent: "center" },
  track: { height: 8, borderWidth: 1, position: "relative", justifyContent: "center" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.5 },
  tick: { position: "absolute", top: -4, width: 1, height: 16 },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    marginLeft: -11,
    borderWidth: 2,
  },
  ends: { flexDirection: "row", justifyContent: "space-between" },
  end: { fontFamily: MONO, fontSize: 10, letterSpacing: 1 },
  logBtn: { height: 54, alignItems: "center", justifyContent: "center", marginTop: "auto", marginBottom: spacing.lg },
  logText: { fontFamily: MONO, fontSize: 15, fontWeight: "700", letterSpacing: 1.5 },
});
