import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BannerBlend } from "@/src/components/BannerBlend";
import { BannerButtons } from "@/src/components/BannerButtons";
import { ClassicBlend } from "@/src/components/ClassicBlend";
import { IceFireEffect, IceFireEffectHandle } from "@/src/components/IceFireEffect";
import { InstrumentBlend } from "@/src/components/InstrumentBlend";
import { InstrumentLog } from "@/src/components/InstrumentLog";
import { LivingSky } from "@/src/components/LivingSky";
import { LogForm, LogFormPayload } from "@/src/components/LogForm";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useTheme } from "@/src/context/ThemeContext";
import { api, todayStr } from "@/src/lib/api";
import { blendToState } from "@/src/lib/blend";
import { pickMessage, SWARA } from "@/src/lib/swara";
import { BreathLog, fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

const USE_NATIVE = Platform.OS !== "web";

function formatDateHeading(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function QuickLogScreen() {
  const { colors, skin } = useTheme();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [creating, setCreating] = useState<NostrilState | null>(null);
  const [activeLog, setActiveLog] = useState<BreathLog | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [moodJournaling, setMoodJournaling] = useState(true);
  const [advanced, setAdvanced] = useState(false);
  const [logVersion, setLogVersion] = useState(0);
  const [guidance, setGuidance] = useState<{ state: NostrilState; message: string } | null>(null);

  // Entrance + ambient "breathing" motion — calm, on-brand, never distracting.
  const enter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const fx = useRef<IceFireEffectHandle>(null);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: USE_NATIVE,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [enter, breathe]);

  const enterTranslate = enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const ringScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const ringOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  useFocusEffect(
    useCallback(() => {
      api<{ mood_journaling?: boolean; advanced_logging?: boolean }>("/settings")
        .then((s) => {
          setMoodJournaling(s.mood_journaling ?? true);
          setAdvanced(s.advanced_logging ?? false);
        })
        .catch(() => {});
    }, []),
  );

  const logState = async (state: NostrilState, blend?: number) => {
    if (creating) return;
    setCreating(state);
    fx.current?.trigger(state);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    try {
      const log = await api<BreathLog>("/logs", {
        method: "POST",
        body: {
          nostril_state: state,
          ...(blend != null ? { blend } : {}),
          tags: [],
          local_date: todayStr(),
          local_hour: new Date().getHours(),
        },
      });
      setGuidance({ state, message: pickMessage(state) });
      setLogVersion((v) => v + 1);
      if (moodJournaling) {
        setActiveLog(log);
        // The sheet is a native Modal and would cover the ice/fire burst —
        // let the effect read first, then slide the context sheet up.
        // (The Instrument skin has no burst; open right after the shutter.)
        setTimeout(() => setSheetOpen(true), skin === "instrument" ? 250 : 1200);
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

  const renderState = (state: NostrilState, isBoth = false) => {
    const meta = STATE_META[state];
    const busy = creating === state;
    return (
      <Pressable
        key={state}
        testID={`quick-log-${state}-button`}
        onPress={() => logState(state)}
        disabled={!!creating}
        style={({ pressed }) => [
          isBoth ? styles.bothBtn : styles.stateBtn,
          {
            backgroundColor: colors[meta.colorKey],
            opacity: busy ? 0.7 : pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Text
          style={[isBoth ? styles.stateLabelSmall : styles.stateLabel, { color: colors[meta.onColorKey] }]}
        >
          {meta.label}
        </Text>
        <Text style={[styles.stateSub, { color: colors[meta.onColorKey], opacity: 0.75 }]}>
          {meta.sub}
        </Text>
      </Pressable>
    );
  };

  // Over the living scene the chrome goes light with soft shadows,
  // independent of the app theme.
  const living = skin === "banners";
  const instrument = skin === "instrument";
  const onScene = living
    ? { color: "#F2F4FC", textShadowColor: "rgba(4,6,14,0.8)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 }
    : null;
  const onSceneDim = living ? { ...onScene, color: "rgba(242,244,252,0.75)" } : null;

  if (instrument) {
    return (
      <View
        testID="quick-log-screen"
        style={[styles.instrumentRoot, { paddingTop: insets.top + spacing.md }]}
      >
        {advanced ? (
          <InstrumentBlend disabled={!!creating} onLog={(r) => logState(blendToState(r), r)} />
        ) : (
          <InstrumentLog creating={creating} onLog={logState} refreshToken={logVersion} />
        )}
        <Sheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={
            activeLog
              ? `${STATE_META[activeLog.nostril_state].label} · ${SWARA[activeLog.nostril_state].sanskrit}`
              : "Add context"
          }
        >
          {activeLog && guidance && guidance.state === activeLog.nostril_state && (
            <Text style={[styles.sheetGuidance, { color: colors.onSurfaceSecondary }]}>{guidance.message}</Text>
          )}
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

  return (
    <View
      testID="quick-log-screen"
      style={[
        styles.root,
        { backgroundColor: living ? "#0A0C16" : colors.surface, paddingTop: insets.top + spacing.lg },
      ]}
    >
      {living && <LivingSky />}

      {/* Rendered first so it sits *behind* the buttons — the ice/fire plays
          beneath them and the buttons stay crisp on top. */}
      <IceFireEffect ref={fx} />

      <Animated.View style={[styles.header, { opacity: enter, transform: [{ translateY: enterTranslate }] }]}>
        <View style={styles.topLine}>
          <View style={styles.dateRow}>
            <View style={styles.pulse}>
              <Animated.View
                style={[
                  styles.pulseRing,
                  { borderColor: colors.brand, opacity: ringOpacity, transform: [{ scale: ringScale }] },
                ]}
              />
              <View style={[styles.pulseDot, { backgroundColor: colors.brand }]} />
            </View>
            <Text style={[styles.date, { color: colors.onSurfaceTertiary }, onSceneDim]}>{formatDateHeading()}</Text>
          </View>
          <Pressable
            testID="log-learn-button"
            onPress={() => router.push("/learn")}
            hitSlop={10}
            style={[
              styles.infoBtn,
              { backgroundColor: living ? "rgba(8,10,20,0.4)" : colors.surfaceTertiary },
            ]}
          >
            <Ionicons
              name="book-outline"
              size={17}
              color={living ? "#F2F4FC" : colors.onSurfaceTertiary}
            />
          </Pressable>
        </View>
        <Text style={[styles.title, { color: colors.onSurface }, onScene]}>What is dominant now?</Text>
        <Text style={[styles.subtitle, { color: colors.onSurfaceTertiary }, onSceneDim]}>
          Log current breath state
        </Text>
      </Animated.View>

      {living ? (
        <Animated.View style={[styles.buttons, { opacity: enter, transform: [{ translateY: enterTranslate }] }]}>
          {advanced ? (
            <BannerBlend disabled={!!creating} onLog={(r) => logState(blendToState(r), r)} />
          ) : (
            <BannerButtons disabled={!!creating} onLog={logState} />
          )}
        </Animated.View>
      ) : (
        /* Left + Right are the frequent states, side by side and tall.
           Both (Sushumna) accrues less, so it sits below as a short bar. */
        <Animated.View style={[styles.buttons, { opacity: enter, transform: [{ translateY: enterTranslate }] }]}>
          {advanced ? (
            <ClassicBlend disabled={!!creating} onLog={(r) => logState(blendToState(r), r)} />
          ) : (
            <>
              <View style={styles.topRow}>
                {renderState("left")}
                {renderState("right")}
              </View>
              {renderState("both", true)}
            </>
          )}
        </Animated.View>
      )}

      {guidance ? (
        <Pressable
          testID="log-guidance-card"
          onPress={() => router.push("/learn")}
          style={[
            styles.guidanceCard,
            living
              ? { backgroundColor: "rgba(8,10,20,0.55)", borderColor: "rgba(255,255,255,0.16)" }
              : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
          ]}
        >
          <View style={styles.guidanceHead}>
            <View style={[styles.guidanceDot, { backgroundColor: colors[STATE_META[guidance.state].colorKey] }]} />
            <Text style={[styles.guidanceState, { color: living ? "rgba(242,244,252,0.7)" : colors.onSurfaceTertiary }]}>
              {STATE_META[guidance.state].label} · {SWARA[guidance.state].sanskrit}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={living ? "rgba(242,244,252,0.7)" : colors.onSurfaceTertiary} />
          </View>
          <Text style={[styles.guidanceText, { color: living ? "#F2F4FC" : colors.onSurface }]}>{guidance.message}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.footerHint, { color: colors.onSurfaceTertiary }, onSceneDim]}>
          Your state changes. Track it clearly.
        </Text>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={
          activeLog
            ? `${STATE_META[activeLog.nostril_state].label} · ${SWARA[activeLog.nostril_state].sanskrit}`
            : "Add context"
        }
      >
        {activeLog && guidance && guidance.state === activeLog.nostril_state && (
          <Text style={[styles.sheetGuidance, { color: colors.onSurfaceSecondary }]}>{guidance.message}</Text>
        )}
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
  instrumentRoot: { flex: 1, backgroundColor: "#FAFAF8" },
  header: { marginBottom: spacing.xl },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  infoBtn: { width: 34, height: 34, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  dateRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pulse: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  pulseRing: { position: "absolute", width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
  pulseDot: { width: 6, height: 6, borderRadius: 3 },
  date: { fontFamily: fonts.medium, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, marginTop: spacing.xs },
  buttons: { flex: 1, gap: spacing.md, paddingBottom: spacing.sm },
  topRow: { flex: 1, flexDirection: "row", gap: spacing.md },
  stateBtn: {
    flex: 1,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  bothBtn: {
    height: 84,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  stateLabel: { fontFamily: fonts.semibold, fontSize: 32, letterSpacing: -0.5 },
  stateLabelSmall: { fontFamily: fonts.semibold, fontSize: 21, letterSpacing: -0.5 },
  stateSub: { fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.xs, textAlign: "center" },
  footerHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  guidanceCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  guidanceHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: 6 },
  guidanceDot: { width: 8, height: 8, borderRadius: 4 },
  guidanceState: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  guidanceText: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21 },
  sheetGuidance: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
});
