import { useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LogForm, LogFormPayload } from "@/src/components/LogForm";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useTheme } from "@/src/context/ThemeContext";
import { api, todayStr } from "@/src/lib/api";
import { BreathLog, fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

function formatDateHeading(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function QuickLogScreen() {
  const { colors } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [creating, setCreating] = useState<NostrilState | null>(null);
  const [activeLog, setActiveLog] = useState<BreathLog | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moodJournaling, setMoodJournaling] = useState(true);

  useFocusEffect(
    useCallback(() => {
      api<{ mood_journaling?: boolean }>("/settings")
        .then((s) => setMoodJournaling(s.mood_journaling ?? true))
        .catch(() => {});
    }, []),
  );

  const logState = async (state: NostrilState) => {
    if (creating) return;
    setCreating(state);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      const log = await api<BreathLog>("/logs", {
        method: "POST",
        body: {
          nostril_state: state,
          tags: [],
          local_date: todayStr(),
          local_hour: new Date().getHours(),
        },
      });
      if (moodJournaling) {
        setActiveLog(log);
        setSheetOpen(true);
      }
      showToast(`Logged · ${STATE_META[state].label}`);
    } catch (e: any) {
      showToast(e.message ?? "Could not save log", "error");
    } finally {
      setCreating(null);
    }
  };

  const saveContext = async (payload: LogFormPayload) => {
    if (!activeLog) return;
    setSaving(true);
    try {
      await api(`/logs/${activeLog.id}`, { method: "PATCH", body: payload });
      setSheetOpen(false);
      showToast("Context added");
    } catch (e: any) {
      showToast(e.message ?? "Could not save details", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View
      testID="quick-log-screen"
      style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top + spacing.lg }]}
    >
      <View style={styles.header}>
        <Text style={[styles.date, { color: colors.onSurfaceTertiary }]}>{formatDateHeading()}</Text>
        <Text style={[styles.title, { color: colors.onSurface }]}>What is dominant now?</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }]}>
          Log current breath state
        </Text>
      </View>

      <View style={styles.buttons}>
        {(Object.keys(STATE_META) as NostrilState[]).map((state) => {
          const meta = STATE_META[state];
          const busy = creating === state;
          // "Both" (Sushumna) occurs far less often, so it gets a smaller button.
          const isBoth = state === "both";
          return (
            <Pressable
              key={state}
              testID={`quick-log-${state}-button`}
              onPress={() => logState(state)}
              disabled={!!creating}
              style={({ pressed }) => [
                styles.stateBtn,
                { flex: isBoth ? 0.5 : 1 },
                {
                  backgroundColor: colors[meta.colorKey],
                  opacity: busy ? 0.7 : pressed ? 0.92 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <Text
                style={[
                  isBoth ? styles.stateLabelSmall : styles.stateLabel,
                  { color: colors[meta.onColorKey] },
                ]}
              >
                {meta.label}
              </Text>
              <Text style={[styles.stateSub, { color: colors[meta.onColorKey], opacity: 0.75 }]}>
                {meta.sub}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.footerHint, { color: colors.onSurfaceTertiary }]}>
        Your state changes. Track it clearly.
      </Text>

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add context">
        <LogForm
          key={activeLog?.id ?? "none"}
          saving={saving}
          onSave={saveContext}
          onSkip={() => setSheetOpen(false)}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  header: { marginBottom: spacing.xl },
  date: { fontFamily: fonts.medium, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontFamily: fonts.semibold, fontSize: 28, marginTop: spacing.sm, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, marginTop: spacing.xs },
  buttons: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  stateBtn: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: "flex-start",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  stateLabel: { fontFamily: fonts.semibold, fontSize: 32, letterSpacing: -0.5 },
  stateLabelSmall: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.5 },
  stateSub: { fontFamily: fonts.medium, fontSize: 14, marginTop: spacing.xs },
  footerHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
});
