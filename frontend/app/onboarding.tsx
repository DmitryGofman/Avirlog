// The welcome flow. Eight pages in two runs:
//   1–3  teach — the idea, the three states, the tap
//   4–6  set up — reminder rhythm, what a reminder looks like, the widget
//   7–8  close — what the log gives you, then the research consent question
//
// Screens 4 and 8 write real settings, so the app is configured by the time
// someone arrives at it; 5 and 6 are illustrative. "Skip setup" jumps to 7
// rather than the end, because the consent question must never be skipped past.
//
// Copy note: the claims here are deliberately hedged to match src/lib/research.ts
// — the cycle is hours-long, irregular, and not universal, and the meaning of a
// side is a hypothesis, not a finding. Do not "tighten" this into the tidier
// popular version; the app's own Theory screen contradicts it.
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Body,
  Dots,
  GhostButton,
  InfoCard,
  Page,
  PrimaryButton,
  Small,
} from "@/src/components/onboarding/OnboardingChrome";
import {
  LiveActivityPreview,
  NotificationPreview,
  WidgetPreview,
} from "@/src/components/onboarding/Previews";
import { useToast } from "@/src/components/Toast";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { hapticPress } from "@/src/lib/haptics";
import { markOnboardingSeen } from "@/src/lib/onboarding";
import { ensurePermission, scheduleNextReminder } from "@/src/lib/notifications";
import { fonts, radius, spacing } from "@/src/theme/theme";

const PAGES = 8;
// Zero-based. The three pages that get their own footer are named so the
// footer's branches can't drift out of step with the page order.
const REMINDER_PAGE = 3;
const BENEFITS_PAGE = 6;
const CONSENT_PAGE = 7;

// Mirrors INTERVALS in app/(tabs)/settings.tsx. An hour is preselected.
const INTERVALS = [
  { label: "30 sec", value: 30 },
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "1 hour", value: 3600 },
];

export default function Onboarding() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();

  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  // Screen 4 state, applied when they tap through.
  const [interval, setIntervalSeconds] = useState(3600);
  const [quiet, setQuiet] = useState(true);
  const [busy, setBusy] = useState(false);

  const goTo = (i: number) => {
    const next = Math.max(0, Math.min(PAGES - 1, i));
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const finish = async (consent: boolean) => {
    if (busy) return;
    setBusy(true);
    hapticPress();
    try {
      await api("/settings", { method: "PUT", body: { research_consent: consent } });
    } catch {
      // A failed write must not trap anyone in onboarding — the same switch
      // lives in Settings, and consent defaults to off.
      showToast("Could not save your choice — you can set it in Settings", "error");
    }
    await markOnboardingSeen();
    router.replace("/(tabs)/log");
  };

  // Turning reminders on needs permission first; declining is not a dead end.
  const enableReminders = async () => {
    if (busy) return;
    setBusy(true);
    hapticPress();
    try {
      if (Platform.OS !== "web") {
        const ok = await ensurePermission();
        if (!ok) {
          showToast("Allow notifications in system settings to get reminders", "error");
          setBusy(false);
          goTo(page + 1);
          return;
        }
      }
      const next = {
        reminder_enabled: true,
        reminder_interval_seconds: interval,
        quiet_hours_enabled: quiet,
      };
      await api("/settings", { method: "PUT", body: next });
      await scheduleNextReminder({
        ...next,
        quiet_start_minutes: 22 * 60,
        quiet_end_minutes: 7 * 60,
      });
    } catch {
      showToast("Could not set reminders — you can turn them on in Settings", "error");
    }
    setBusy(false);
    goTo(page + 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.surface, paddingTop: insets.top }]}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
      >
        {/* 1 — welcome */}
        <Page eyebrow="AvirLog" title="One nostril is doing more of the work" width={width} centered>
          <View style={styles.mark}>
            <View style={[styles.markLeft, { backgroundColor: colors.stateLeft }]} />
            <View style={[styles.markRight, { backgroundColor: colors.stateRight }]} />
          </View>
          <Body>
            Right now, probably. In an hour or three it may have swapped. This app is for noticing.
          </Body>
        </Page>

        {/* 2 — the nasal cycle */}
        <Page eyebrow="The nasal cycle" title="Real physiology — but not a clock" width={width}>
          <Body>
            Dominance alternates over hours, typically one to four per side. It is irregular, and in
            one study only about 72% of people showed a clearly defined cycle. Yours is worth
            measuring rather than assuming.
          </Body>
          <InfoCard pip={colors.stateLeft} title="Left · Ida" text="Tradition links it to calm and cooling." />
          <InfoCard pip={colors.stateRight} title="Right · Pingala" text="Tradition links it to activity and heat." />
          <InfoCard pip={colors.stateBoth} title="Both · Sushumna" text="The balanced in-between, prized for meditation." />
          <Small>
            What each side means is a hypothesis with mixed evidence — see Theory &amp; evidence in
            Settings.
          </Small>
        </Page>

        {/* 3 — how to log */}
        <Page eyebrow="Checking takes five seconds" title="Breathe, notice, tap" width={width}>
          <Body>
            Close one nostril, breathe in. Then the other. Tap whichever side felt freer — or Both if
            you cannot tell them apart.
          </Body>
          <View style={styles.demoRow}>
            <View style={[styles.demoBtn, { backgroundColor: colors.stateLeft }]}>
              <Text style={styles.demoLabel}>Left</Text>
              <Text style={styles.demoSub}>Ida · Calming</Text>
            </View>
            <View style={[styles.demoBtn, { backgroundColor: colors.stateRight }]}>
              <Text style={styles.demoLabel}>Right</Text>
              <Text style={styles.demoSub}>Pingala · Active</Text>
            </View>
          </View>
          <View style={[styles.demoBoth, { backgroundColor: colors.stateBoth }]}>
            <Text style={styles.demoBothLabel}>Both · Sushumna</Text>
          </View>
          <Small>Next: three quick settings so a check never interrupts anything.</Small>
        </Page>

        {/* 4 — reminders (writes settings) */}
        <Page eyebrow="Setup · 1 of 3" title="How often should we nudge you?" width={width}>
          <Body>
            One reminder at a time. The next is armed once you answer the current one — or next time
            you open the app — so missed alerts never pile up.
          </Body>
          <View style={styles.pills}>
            {INTERVALS.map((i) => {
              const on = interval === i.value;
              return (
                <Pressable
                  key={i.value}
                  testID={`onboarding-interval-${i.value}`}
                  onPress={() => setIntervalSeconds(i.value)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: on ? colors.surfaceInverse : colors.surfaceTertiary,
                      borderColor: on ? colors.surfaceInverse : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: on ? colors.onSurfaceInverse : colors.onSurfaceTertiary },
                    ]}
                  >
                    {i.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Small>
            An hour is a good place to start. The short ones are there so you can watch the whole
            loop work today.
          </Small>
          <View
            style={[
              styles.quietRow,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
            ]}
          >
            <View style={styles.quietText}>
              <Text style={[styles.quietTitle, { color: colors.onSurface }]}>Sleep time</Text>
              <Text style={[styles.quietSub, { color: colors.onSurfaceTertiary }]}>
                Silent 22:00 → 07:00
              </Text>
            </View>
            <Switch
              testID="onboarding-quiet-switch"
              value={quiet}
              onValueChange={setQuiet}
              trackColor={{ false: colors.border, true: colors.brand }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Page>

        {/* 5 — what a reminder looks like */}
        <Page eyebrow="Setup · 2 of 3" title="What a nudge looks like" width={width}>
          <Body>Both let you answer without opening AvirLog.</Body>
          <Small>A notification — hold it to reveal the buttons</Small>
          <View style={styles.previewGap}>
            <NotificationPreview />
          </View>
          <Small>A Live Activity — sits on the Lock Screen, counting down</Small>
          <View style={styles.previewGap}>
            <LiveActivityPreview />
          </View>
          <Small>Choose either or both under Reminders in Settings.</Small>
        </Page>

        {/* 6 — the widget */}
        <Page eyebrow="Setup · 3 of 3" title="Put it where your thumb already is" width={width}>
          <Body>A widget logs in one tap — no app, no unlock.</Body>
          <View style={styles.previewGap}>
            <WidgetPreview />
          </View>
          <Step n={1} text="Touch and hold your Home Screen, then tap +." />
          <Step n={2} text="Search AvirLog. Pick Breath Log for the three buttons, or Breath Blend for preset percentages." />
          <Step n={3} text="Choose a size and add it. Taps register even while locked." />
        </Page>

        {/* 7 — benefits */}
        <Page eyebrow="Why keep the log" title="Patterns you cannot see in a day" width={width}>
          <InfoCard
            title="Your record, day by day"
            text="How often each side led, your average balance, and your most one-sided readings."
          />
          <InfoCard
            title="Mood, energy, focus"
            text="Score a log if you want to; the daily averages sit beside your balance."
          />
          <InfoCard
            title="Timing choices"
            text="Tradition says to eat, rest and start hard work on the matching swara. Test it on your own data."
          />
        </Page>

        {/* 8 — research consent */}
        <Page eyebrow="One question before you start" title="Help map the human nasal cycle" width={width}>
          <Body>
            AvirLog is also a research project. With your permission, your logs join an anonymized
            dataset used to study real breath patterns across many people.
          </Body>
          <InfoCard
            title="Shared"
            text="Nostril side, blend, time of day and timezone offset, and any mood / energy / focus scores."
          />
          <InfoCard title="Never shared" text="Your name, email, notes, or anything identifying." />
          <InfoCard
            title="Your call, always"
            text="Opt out any time in Settings; deleting your account deletes your data."
          />
          <Small>You will see what the dataset learns in the Everyone tab, coming to the app.</Small>
        </Page>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
        <Dots count={PAGES} index={page} />
        {page === CONSENT_PAGE ? (
          <>
            <PrimaryButton
              testID="onboarding-consent-yes"
              label="Count me in"
              onPress={() => finish(true)}
              disabled={busy}
            />
            <GhostButton
              testID="onboarding-consent-no"
              label="Not now — just log privately"
              onPress={() => finish(false)}
            />
          </>
        ) : page === REMINDER_PAGE ? (
          <>
            <PrimaryButton
              testID="onboarding-enable-reminders"
              label="Turn on reminders"
              onPress={enableReminders}
              disabled={busy}
            />
            <GhostButton
              testID="onboarding-skip-setup"
              label="Skip setup — I'll do it in Settings"
              onPress={() => goTo(BENEFITS_PAGE)}
            />
          </>
        ) : (
          <PrimaryButton
            testID="onboarding-continue"
            label="Continue"
            onPress={() => goTo(page + 1)}
          />
        )}
      </View>
    </View>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: colors.surfaceTertiary }]}>
        <Text style={[styles.stepNumText, { color: colors.onSurface }]}>{n}</Text>
      </View>
      <Text style={[styles.stepText, { color: colors.onSurfaceSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  footer: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm },

  mark: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", marginBottom: spacing.xl },
  markLeft: { width: 62, height: 100, borderRadius: 31, borderBottomRightRadius: 10 },
  markRight: { width: 62, height: 100, borderRadius: 31, borderBottomLeftRadius: 10 },

  demoRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  demoBtn: { flex: 1, borderRadius: radius.md, paddingVertical: spacing.xl, alignItems: "center" },
  demoLabel: { fontFamily: fonts.semibold, fontSize: 20, color: "#FFFFFF" },
  demoSub: { fontFamily: fonts.regular, fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  demoBoth: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  demoBothLabel: { fontFamily: fonts.semibold, fontSize: 14, color: "#FFFFFF" },

  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  pillText: { fontFamily: fonts.medium, fontSize: 12 },

  quietRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  quietText: { flex: 1 },
  quietTitle: { fontFamily: fonts.semibold, fontSize: 14 },
  quietSub: { fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },

  previewGap: { marginTop: spacing.xs, marginBottom: spacing.md },

  step: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  stepNum: { width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontFamily: fonts.bold, fontSize: 10 },
  stepText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
});
