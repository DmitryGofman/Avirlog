// The "Instrument" skin: the Log screen as a Swiss monochrome measuring
// device. Masthead with a live clock, a data readout strip computed from
// today's samples, bordered record cells (one tap = one sample), a recent-log
// ticker, and a camera-shutter flash on press. Fixed light look, independent
// of the app theme — like a sheet of instrument paper.
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { api, todayStr } from "@/src/lib/api";
import { BreathLog, NostrilState } from "@/src/theme/theme";

const INK = "#111111";
const PAPER = "#FAFAF8";
const PAPER_PRESSED = "#111111";
const DIM = "#666666";
const SOFT = "#E0E0DC";

const MONO = Platform.select({ ios: "Menlo", default: "monospace" });

const LETTER: Record<NostrilState, string> = { left: "L", right: "R", both: "B" };

interface InstrumentLogProps {
  creating: NostrilState | null;
  onLog: (state: NostrilState) => void;
  // bump after each successful log so the readout refreshes
  refreshToken: number;
}

export function InstrumentLog({ creating, onLog, refreshToken }: InstrumentLogProps) {
  const [clock, setClock] = useState(() => new Date().toTimeString().slice(0, 8));
  const [logs, setLogs] = useState<BreathLog[]>([]);
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toTimeString().slice(0, 8)), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchToday = useCallback(() => {
    api<BreathLog[]>(`/logs?date=${todayStr()}`)
      .then((l) => setLogs(l))
      .catch(() => {});
  }, []);

  useFocusEffect(fetchToday);
  useEffect(fetchToday, [refreshToken, fetchToday]);

  const press = (state: NostrilState) => {
    // camera-shutter flash
    flash.setValue(0.9);
    Animated.timing(flash, { toValue: 0, duration: 160, useNativeDriver: Platform.OS !== "web" }).start();
    onLog(state);
  };

  // ---- readout numbers ----
  const count = logs.length;
  const tally: Record<NostrilState, number> = { left: 0, right: 0, both: 0 };
  for (const l of logs) tally[l.nostril_state] += 1;
  const domState = (Object.keys(tally) as NostrilState[]).reduce((a, b) => (tally[b] > tally[a] ? b : a), "left");
  const dominant = count === 0 ? "—" : `${LETTER[domState]} ${Math.round((tally[domState] / count) * 100)}%`;
  const sorted = [...logs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const lastLog = sorted[0];
  const last = lastLog
    ? `${LETTER[lastLog.nostril_state]} -${Math.max(0, Math.round((Date.now() - new Date(lastLog.created_at).getTime()) / 60000))}m`
    : "—";
  const ticker =
    sorted
      .slice(0, 4)
      .map((l) => `${new Date(l.created_at).toTimeString().slice(0, 5)} ${LETTER[l.nostril_state]}`)
      .join(" · ") || "// no samples yet";

  const dateLine = new Date()
    .toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })
    .toUpperCase();

  const cellPressed = (state: NostrilState, pressed: boolean) =>
    pressed || creating === state ? PAPER_PRESSED : PAPER;
  const textPressed = (state: NostrilState, pressed: boolean) =>
    pressed || creating === state ? PAPER : INK;

  return (
    <View style={styles.root} testID="instrument-log">
      <View style={styles.masthead}>
        <Text style={styles.app}>AVIRLOG/01</Text>
        <View style={styles.mastRight}>
          <Text style={styles.meta}>{dateLine}</Text>
          <Text style={styles.meta}>{clock}</Text>
        </View>
      </View>

      <View style={styles.readout}>
        <View style={[styles.cell, styles.cellBorder]}>
          <Text style={styles.k}>TODAY</Text>
          <Text style={styles.v}>{String(count).padStart(2, "0")}</Text>
        </View>
        <View style={[styles.cell, styles.cellBorder]}>
          <Text style={styles.k}>DOMINANT</Text>
          <Text style={styles.v}>{dominant}</Text>
        </View>
        <View style={styles.cell}>
          <Text style={styles.k}>LAST</Text>
          <Text style={styles.v}>{last}</Text>
        </View>
      </View>

      <View style={styles.prompt}>
        <Text style={styles.h1}>RECORD STATE</Text>
        <Text style={styles.sub}>SELECT ACTIVE CHANNEL // ONE TAP = ONE SAMPLE</Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.pair}>
          <Pressable
            testID="quick-log-left-button"
            disabled={!!creating}
            onPress={() => press("left")}
            style={({ pressed }) => [styles.nostril, { backgroundColor: cellPressed("left", pressed) }]}
          >
            {({ pressed }) => (
              <>
                <Text style={[styles.idx, { color: pressed ? PAPER : DIM }]}>01</Text>
                <Text style={[styles.name, { color: textPressed("left", pressed) }]}>LEFT</Text>
                <Text style={[styles.trad, { color: pressed ? PAPER : DIM }]}>IDA / PARASYMPATHETIC</Text>
              </>
            )}
          </Pressable>
          <Pressable
            testID="quick-log-right-button"
            disabled={!!creating}
            onPress={() => press("right")}
            style={({ pressed }) => [
              styles.nostril,
              styles.nostrilRight,
              { backgroundColor: cellPressed("right", pressed) },
            ]}
          >
            {({ pressed }) => (
              <>
                <Text style={[styles.idx, { color: pressed ? PAPER : DIM }]}>02</Text>
                <Text style={[styles.name, { color: textPressed("right", pressed) }]}>RIGHT</Text>
                <Text style={[styles.trad, { color: pressed ? PAPER : DIM }]}>PINGALA / SYMPATHETIC</Text>
              </>
            )}
          </Pressable>
        </View>
        <Pressable
          testID="quick-log-both-button"
          disabled={!!creating}
          onPress={() => press("both")}
          style={({ pressed }) => [styles.both, { backgroundColor: cellPressed("both", pressed) }]}
        >
          {({ pressed }) => (
            <>
              <Text style={[styles.bothName, { color: textPressed("both", pressed) }]}>BOTH</Text>
              <Text style={[styles.trad, { color: pressed ? PAPER : DIM }]}>03 · SUSHUMNA / BALANCED</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.ticker}>
        <Text style={styles.tickerText} numberOfLines={1}>
          {ticker}
        </Text>
        <Text style={styles.tickerText}>▮</Text>
      </View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, { opacity: flash }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  masthead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  app: { fontFamily: MONO, fontSize: 14, fontWeight: "700", letterSpacing: 1, color: INK },
  mastRight: { alignItems: "flex-end" },
  meta: { fontFamily: MONO, fontSize: 10, color: DIM, lineHeight: 15 },

  readout: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK },
  cell: { flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  cellBorder: { borderRightWidth: 1, borderRightColor: INK },
  k: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.5, color: DIM },
  v: { fontFamily: MONO, fontSize: 19, fontWeight: "700", color: INK, marginTop: 3 },

  prompt: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 10 },
  h1: { fontSize: 27, fontWeight: "800", letterSpacing: -0.8, color: INK },
  sub: { fontFamily: MONO, fontSize: 10.5, color: DIM, marginTop: 6 },

  grid: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 18 },
  pair: { flex: 1, flexDirection: "row" },
  nostril: { flex: 1, borderWidth: 1, borderColor: INK, padding: 16, justifyContent: "space-between" },
  nostrilRight: { borderLeftWidth: 0 },
  idx: { fontFamily: MONO, fontSize: 10 },
  name: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  trad: { fontFamily: MONO, fontSize: 8.5, letterSpacing: 1.2 },
  both: {
    height: 58,
    borderWidth: 1,
    borderColor: INK,
    borderTopWidth: 0,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bothName: { fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },

  ticker: {
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  tickerText: { fontFamily: MONO, fontSize: 10, color: "#444444", flexShrink: 1 },
  flash: { backgroundColor: INK, zIndex: 10 },
});

export const INSTRUMENT_PAPER = PAPER;
export const INSTRUMENT_SOFT = SOFT;
