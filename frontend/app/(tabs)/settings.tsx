import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader, useSkinUi } from "@/src/components/ScreenHeader";
import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { ACCOUNTS_ENABLED, DEFAULT_SKIN, SKINS, SkinId } from "@/src/lib/config";
import {
  cancelReminders,
  ensurePermission,
  REMINDER_STYLES,
  ReminderStyle,
  scheduleNextReminder,
} from "@/src/lib/notifications";
import { buildStamp, CODE_REVISION_NOTE } from "@/src/lib/buildInfo";
import { getRealisticRoll, setRealisticRoll } from "@/src/lib/rollPref";
import { setWidgetAdvanced } from "@/src/lib/widgetBridge";
import { fonts, radius, spacing } from "@/src/theme/theme";

interface Settings {
  reminder_enabled: boolean;
  reminder_interval_seconds: number;
  quiet_hours_enabled: boolean;
  quiet_start_minutes: number;
  quiet_end_minutes: number;
  theme: "light" | "dark";
  mood_journaling: boolean;
  skin: SkinId;
  advanced_logging: boolean;
  reminder_style: ReminderStyle;
}

const INTERVALS = [
  { label: "30 sec", value: 30 },
  { label: "1 min", value: 60 },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "1 hour", value: 3600 },
];

function fmtInterval(sec: number): string {
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) return `${Math.round(sec / 60)} min`;
  return `${Math.round(sec / 3600)} hr`;
}

function fmtClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
  testID: string;
  danger?: boolean;
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

type Palette = ReturnType<typeof useTheme>["colors"];
type SkinUi = ReturnType<typeof useSkinUi>;

// Row and Section MUST live at module scope. Declared inside the screen they
// were a brand-new component type on every render, so React unmounted and
// rebuilt the whole settings tree on each toggle — which tore down touch
// targets mid-gesture and made taps land on the wrong row.
function SettingsRow({
  icon,
  label,
  right,
  onPress,
  testID,
  danger,
  colors,
  ui,
}: RowProps & { colors: Palette; ui: SkinUi }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed && onPress ? 0.7 : 1 }]}
    >
      <View style={[styles.rowIcon, ui.sq, { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name={icon} size={16} color={danger ? colors.error : colors.onBrandTertiary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? colors.error : colors.onSurface }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>{right}</View>
    </Pressable>
  );
}

function SettingsSection({ title, children, colors, ui }: SectionProps & { colors: Palette; ui: SkinUi }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, ui.monoLabel, { color: colors.onSurfaceTertiary }]}>{title}</Text>
      <View style={[styles.sectionCard, ui.sq, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { colors, mode, setMode, setSkin } = useTheme();
  const ui = useSkinUi();
  const { user, signOut, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  // Local-only: GPU-shaded banner roll vs the original view-layer one.
  const [realisticRoll, setRealisticRollState] = useState(true);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [quietEdit, setQuietEdit] = useState<null | "start" | "end">(null);
  const [quietValue, setQuietValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api<Settings>("/settings")
      .then((s) =>
        setSettings({
          ...s,
          mood_journaling: s.mood_journaling ?? true,
          skin: s.skin ?? DEFAULT_SKIN,
          advanced_logging: s.advanced_logging ?? false,
          reminder_style: s.reminder_style ?? "both",
        }),
      )
      .catch(() => showToast("Could not load settings", "error"));
    getRealisticRoll().then(setRealisticRollState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-arm the chained reminder whenever a relevant setting changes.
  const rearm = (s: Settings) => {
    if (s.reminder_enabled && Platform.OS !== "web") {
      scheduleNextReminder(s).catch(() => {});
    }
  };

  const persist = async (next: Settings) => {
    setSettings(next);
    try {
      await api("/settings", { method: "PUT", body: next });
    } catch {
      showToast("Could not save settings", "error");
    }
  };

  const toggleTheme = (dark: boolean) => {
    const nextMode = dark ? "dark" : "light";
    setMode(nextMode);
    if (settings) persist({ ...settings, theme: nextMode });
  };

  const toggleReminders = async (enabled: boolean) => {
    if (!settings) return;
    if (enabled && Platform.OS !== "web") {
      const ok = await ensurePermission();
      if (!ok) {
        showToast("Allow notifications in system settings to get reminders", "error");
        return;
      }
    }
    const next = { ...settings, reminder_enabled: enabled };
    if (enabled) {
      await scheduleNextReminder(next);
      showToast(`Reminders every ${fmtInterval(next.reminder_interval_seconds)}`);
    } else {
      await cancelReminders();
    }
    persist(next);
  };

  const toggleMoodJournaling = (enabled: boolean) => {
    if (!settings) return;
    persist({ ...settings, mood_journaling: enabled });
  };

  const toggleAdvancedLogging = (enabled: boolean) => {
    if (!settings) return;
    persist({ ...settings, advanced_logging: enabled });
    // Flip the widget + Live Activity between preset-blend and Left/Right/Both.
    setWidgetAdvanced(enabled);
  };

  const toggleRealisticRoll = (enabled: boolean) => {
    setRealisticRollState(enabled);
    setRealisticRoll(enabled);
    showToast(enabled ? "Realistic roll on — reopen Log to see it" : "Realistic roll off");
  };

  // Changing the alert style re-arms the chain so the switch takes effect on
  // the very next reminder rather than the one after it.
  const setReminderStyleValue = async (style: ReminderStyle) => {
    if (!settings) return;
    const next = { ...settings, reminder_style: style };
    persist(next);
    if (next.reminder_enabled && Platform.OS !== "web") {
      await cancelReminders();
      await scheduleNextReminder(next).catch(() => {});
    }
  };

  const setInterval = (seconds: number) => {
    if (!settings) return;
    const next = { ...settings, reminder_interval_seconds: seconds };
    rearm(next);
    persist(next);
  };

  const saveCustom = () => {
    const v = parseInt(customValue, 10);
    if (isNaN(v) || v < 5 || v > 86400) {
      showToast("Enter seconds between 5 and 86400", "error");
      return;
    }
    setInterval(v);
    setCustomOpen(false);
    showToast("Reminder interval saved");
  };

  const toggleQuiet = (enabled: boolean) => {
    if (!settings) return;
    const next = { ...settings, quiet_hours_enabled: enabled };
    rearm(next);
    persist(next);
  };

  const saveQuiet = () => {
    if (!settings || !quietEdit) return;
    const h = parseInt(quietValue, 10);
    if (isNaN(h) || h < 0 || h > 23) {
      showToast("Enter an hour between 0 and 23", "error");
      return;
    }
    const next =
      quietEdit === "start"
        ? { ...settings, quiet_start_minutes: h * 60 }
        : { ...settings, quiet_end_minutes: h * 60 };
    rearm(next);
    persist(next);
    setQuietEdit(null);
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const data = await api("/export");
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(json);
        showToast("Export copied to clipboard");
      } else {
        await Share.share({ message: json, title: "AvirLog export" });
      }
    } catch {
      showToast("Export failed", "error");
    } finally {
      setExporting(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setBusy(true);
    try {
      await deleteAccount();
    } catch {
      showToast("Could not delete account", "error");
      setBusy(false);
    }
  };

  const isPresetInterval = INTERVALS.some((i) => i.value === settings?.reminder_interval_seconds);

  const Row = useCallback(
    (props: RowProps) => <SettingsRow {...props} colors={colors} ui={ui} />,
    [colors, ui],
  );

  const Section = useCallback(
    (props: SectionProps) => <SettingsSection {...props} colors={colors} ui={ui} />,
    [colors, ui],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <ScreenHeader index="05" title="Settings" subtitle="Configuration" topInset={insets.top} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="Account">
          {!ACCOUNTS_ENABLED ? (
            <>
              <Row icon="phone-portrait-outline" label="On this device" testID="settings-local-row" />
              <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
                Your logs and settings are saved on this device.
              </Text>
            </>
          ) : user ? (
            <Row
              icon="person-outline"
              label={user.email}
              testID="settings-email-row"
              right={
                <Text style={[styles.providerText, { color: colors.onSurfaceTertiary }]}>
                  {user.auth_provider === "google" ? "Google" : "Email"}
                </Text>
              }
            />
          ) : (
            <>
              <Row
                icon="cloud-upload-outline"
                label="Sign in to sync"
                testID="settings-signin-row"
                onPress={() => router.push("/login")}
                right={<Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />}
              />
              <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
                Your logs are saved on this device. Sign in to back them up and sync across devices.
              </Text>
            </>
          )}
        </Section>

        <Section title="Skin">
          {SKINS.map((s, i) => (
            <React.Fragment key={s.id}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
              <Row
                icon={
                  s.id === "banners" ? "flag-outline" : s.id === "instrument" ? "grid-outline" : "square-outline"
                }
                label={s.name}
                testID={`settings-skin-${s.id}`}
                onPress={() => {
                  if (settings) persist({ ...settings, skin: s.id });
                  setSkin(s.id);
                }}
                right={
                  settings?.skin === s.id ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color={colors.border} />
                  )
                }
              />
            </React.Fragment>
          ))}
          <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
            Skins change how the Log screen looks and feels. A growing skin library is planned as a
            premium upgrade.
          </Text>
        </Section>

        <Section title="Appearance">
          <Row
            icon="moon-outline"
            label="Dark mode"
            testID="settings-darkmode-row"
            right={
              <Switch
                testID="settings-darkmode-switch"
                value={mode === "dark"}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor="#FFFFFF"
              />
            }
          />
        </Section>

        <Section title="Journaling">
          <Row
            icon="heart-outline"
            label="Mood journaling"
            testID="settings-mood-journaling-row"
            right={
              settings ? (
                <Switch
                  testID="settings-mood-journaling-switch"
                  value={settings.mood_journaling}
                  onValueChange={toggleMoodJournaling}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              ) : (
                <ActivityIndicator size="small" color={colors.brand} />
              )
            }
          />
          <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
            When on, logging a nostril opens a sheet to add mood, energy, focus, tags and a note. When
            off, AvirLog stays minimal — one tap logs which nostril is active.
          </Text>
        </Section>

        <Section title="Logging">
          <Row
            icon="swap-horizontal-outline"
            label="Advanced logging"
            testID="settings-advanced-logging-row"
            right={
              settings ? (
                <Switch
                  testID="settings-advanced-logging-switch"
                  value={settings.advanced_logging}
                  onValueChange={toggleAdvancedLogging}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              ) : (
                <ActivityIndicator size="small" color={colors.brand} />
              )
            }
          />
          <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
            Swaps the Left / Right / Both buttons for a blend control — on the Living Banners skin
            the two flags unroll down the pole, otherwise a slider — so you can log how open
            each nostril is (e.g. 70% right / 30% left). The widget, Live Activity and reminder also
            switch to quick preset-blend buttons. A near-even split still records as Sushumna.
            Switch back anytime; older logs stay readable.
          </Text>
          <Row
            icon="color-wand-outline"
            label="Realistic banner roll"
            testID="settings-realistic-roll-row"
            right={
              <Switch
                testID="settings-realistic-roll-switch"
                value={realisticRoll}
                onValueChange={toggleRealisticRoll}
                trackColor={{ false: colors.border, true: colors.brand }}
                thumbColor="#FFFFFF"
              />
            }
          />
          <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
            Living Banners only. Draws the rolled cloth with a GPU shader — a real
            lit cylinder instead of a flat bar. Turn it off to compare with the
            original.
          </Text>
        </Section>

        <Section title="About">
          <Row
            icon="information-circle-outline"
            label={buildStamp()}
            testID="settings-build-row"
          />
          <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary, paddingBottom: spacing.lg }]}>
            This build: {CODE_REVISION_NOTE}. The version stays 1.0.0 between
            TestFlight builds, so check the code marker to confirm an update
            actually installed.
          </Text>
        </Section>

        <Section title="Learn">
          <Row
            icon="flask-outline"
            label="Theory & evidence"
            testID="settings-theory-row"
            onPress={() => router.push("/theory")}
            right={<Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />}
          />
          <Row
            icon="book-outline"
            label="Swara Yoga guide"
            testID="settings-learn-row"
            onPress={() => router.push("/learn")}
            right={<Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />}
          />
        </Section>

        <Section title="Reminders">
          <Row
            icon="notifications-outline"
            label="Enable reminders"
            testID="settings-reminders-row"
            right={
              settings ? (
                <Switch
                  testID="settings-reminders-switch"
                  value={settings.reminder_enabled}
                  onValueChange={toggleReminders}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              ) : (
                <ActivityIndicator size="small" color={colors.brand} />
              )
            }
          />
          {settings?.reminder_enabled && (
            <View style={styles.intervalWrap}>
              <Text style={[styles.reminderSub, { color: colors.onSurfaceTertiary }]}>Every</Text>
              <View style={styles.intervalRow}>
                {INTERVALS.map((i) => {
                  const selected = settings.reminder_interval_seconds === i.value;
                  return (
                    <Pressable
                      key={i.value}
                      testID={`settings-interval-${i.value}`}
                      onPress={() => setInterval(i.value)}
                      style={[
                        styles.intervalPill,
                        {
                          backgroundColor: selected ? colors.surfaceInverse : colors.surfaceTertiary,
                          borderColor: selected ? colors.surfaceInverse : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.intervalText,
                          { color: selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary },
                        ]}
                      >
                        {i.label}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  testID="settings-interval-custom"
                  onPress={() => {
                    setCustomValue(String(settings.reminder_interval_seconds));
                    setCustomOpen(true);
                  }}
                  style={[
                    styles.intervalPill,
                    {
                      backgroundColor: !isPresetInterval ? colors.surfaceInverse : colors.surfaceTertiary,
                      borderColor: !isPresetInterval ? colors.surfaceInverse : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.intervalText,
                      { color: !isPresetInterval ? colors.onSurfaceInverse : colors.onSurfaceTertiary },
                    ]}
                  >
                    {!isPresetInterval ? fmtInterval(settings.reminder_interval_seconds) : "Custom"}
                  </Text>
                </Pressable>
              </View>

              {/* Alert style — which of the two prompts you actually get */}
              <Text style={[styles.reminderSub, { color: colors.onSurfaceTertiary, marginTop: spacing.md }]}>
                Alert style
              </Text>
              <View style={styles.intervalRow}>
                {REMINDER_STYLES.map((s) => {
                  const selected = settings.reminder_style === s.value;
                  return (
                    <Pressable
                      key={s.value}
                      testID={`settings-style-${s.value}`}
                      onPress={() => setReminderStyleValue(s.value)}
                      style={[
                        styles.intervalPill,
                        {
                          backgroundColor: selected ? colors.surfaceInverse : colors.surfaceTertiary,
                          borderColor: selected ? colors.surfaceInverse : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.intervalText,
                          { color: selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary },
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary }]}>
                {settings.reminder_style === "banner"
                  ? "Only the notification — it buzzes, and holding it reveals the log buttons. No Live Activity or Dynamic Island."
                  : settings.reminder_style === "live"
                    ? "Only the Live Activity — a silent countdown card on the Lock Screen and in the Dynamic Island, with the log buttons on it. Nothing buzzes, so check it yourself."
                    : "Both — the Live Activity counts down on the Lock Screen and the notification buzzes when the time comes."}
              </Text>

              {/* Sleep time — no reminders inside this window */}
              <View style={styles.quietHeader}>
                <Text style={[styles.reminderSub, { color: colors.onSurfaceTertiary }]}>Sleep time</Text>
                <Switch
                  testID="settings-quiet-switch"
                  value={settings.quiet_hours_enabled}
                  onValueChange={toggleQuiet}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {settings.quiet_hours_enabled && (
                <View style={styles.intervalRow}>
                  <Pressable
                    testID="settings-quiet-start"
                    onPress={() => {
                      setQuietValue(String(Math.floor(settings.quiet_start_minutes / 60)));
                      setQuietEdit("start");
                    }}
                    style={[styles.intervalPill, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}
                  >
                    <Text style={[styles.intervalText, { color: colors.onSurfaceTertiary }]}>
                      From {fmtClock(settings.quiet_start_minutes)}
                    </Text>
                  </Pressable>
                  <Pressable
                    testID="settings-quiet-end"
                    onPress={() => {
                      setQuietValue(String(Math.floor(settings.quiet_end_minutes / 60)));
                      setQuietEdit("end");
                    }}
                    style={[styles.intervalPill, { backgroundColor: colors.surfaceTertiary, borderColor: colors.border }]}
                  >
                    <Text style={[styles.intervalText, { color: colors.onSurfaceTertiary }]}>
                      To {fmtClock(settings.quiet_end_minutes)}
                    </Text>
                  </Pressable>
                </View>
              )}

              <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary }]}>
                One reminder at a time — the next is armed after you respond to it (or reopen the app).
                Hold the notification to reveal the log buttons. Logging anywhere — in the app, on the
                widget, from the notification — clears whatever is still showing. Delivered on the
                installed app, not the web preview.
              </Text>
            </View>
          )}
        </Section>

        <Section title="Data">
          <Row
            icon="download-outline"
            label="Export data"
            testID="settings-export-row"
            onPress={exportData}
            right={
              exporting ? (
                <ActivityIndicator size="small" color={colors.brand} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
              )
            }
          />
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <Row
            icon="shield-checkmark-outline"
            label="Privacy policy"
            testID="settings-privacy-row"
            onPress={() => router.push("/privacy")}
            right={<Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />}
          />
        </Section>

        {ACCOUNTS_ENABLED && user && (
          <Section title="Session">
            <Row
              icon="log-out-outline"
              label="Sign out"
              testID="settings-signout-row"
              onPress={() => signOut()}
              right={<Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />}
            />
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <Row
              icon="trash-outline"
              label="Delete account"
              testID="settings-delete-account-row"
              onPress={() => setDeleteOpen(true)}
              danger
            />
          </Section>
        )}
      </ScrollView>

      <Sheet visible={customOpen} onClose={() => setCustomOpen(false)} title="Custom interval">
        <Text style={[styles.sheetLabel, { color: colors.onSurfaceTertiary }]}>
          Seconds between reminders (5–86400)
        </Text>
        <TextInput
          testID="settings-custom-interval-input"
          style={[
            styles.customInput,
            { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderColor: colors.border },
          ]}
          keyboardType="number-pad"
          value={customValue}
          onChangeText={setCustomValue}
          placeholder="120"
          placeholderTextColor={colors.onSurfaceTertiary}
        />
        <Pressable
          testID="settings-custom-interval-save"
          onPress={saveCustom}
          style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onBrandPrimary }]}>Save</Text>
        </Pressable>
      </Sheet>

      <Sheet
        visible={!!quietEdit}
        onClose={() => setQuietEdit(null)}
        title={quietEdit === "start" ? "Sleep starts at" : "Sleep ends at"}
      >
        <Text style={[styles.sheetLabel, { color: colors.onSurfaceTertiary }]}>Hour of day (0–23)</Text>
        <TextInput
          testID="settings-quiet-input"
          style={[
            styles.customInput,
            { backgroundColor: colors.surfaceTertiary, color: colors.onSurface, borderColor: colors.border },
          ]}
          keyboardType="number-pad"
          value={quietValue}
          onChangeText={setQuietValue}
          placeholder="22"
          placeholderTextColor={colors.onSurfaceTertiary}
        />
        <Pressable
          testID="settings-quiet-save"
          onPress={saveQuiet}
          style={[styles.primaryBtn, { backgroundColor: colors.brandPrimary }]}
        >
          <Text style={[styles.primaryBtnText, { color: colors.onBrandPrimary }]}>Save</Text>
        </Pressable>
      </Sheet>

      <Sheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account?">
        <Text style={[styles.sheetLabel, { color: colors.onSurfaceTertiary }]}>
          All of your logs and settings will be permanently removed. This cannot be undone.
        </Text>
        <Pressable
          testID="confirm-delete-account-button"
          onPress={confirmDeleteAccount}
          disabled={busy}
          style={[styles.primaryBtn, { backgroundColor: colors.error, opacity: busy ? 0.7 : 1 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onError} />
          ) : (
            <Text style={[styles.primaryBtnText, { color: colors.onError }]}>Delete my account</Text>
          )}
        </Pressable>
        <Pressable
          testID="cancel-delete-account-button"
          onPress={() => setDeleteOpen(false)}
          style={styles.cancelBtn}
        >
          <Text style={[styles.cancelText, { color: colors.onSurfaceTertiary }]}>Cancel</Text>
        </Pressable>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.semibold, fontSize: 28, letterSpacing: -0.5 },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    gap: spacing.md,
  },
  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontFamily: fonts.medium, fontSize: 15, flex: 1 },
  rowRight: { alignItems: "flex-end" },
  providerText: { fontFamily: fonts.regular, fontSize: 13 },
  divider: { height: 1, marginLeft: 40 },
  intervalWrap: { paddingBottom: spacing.lg },
  intervalRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  reminderSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  quietHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  intervalPill: {
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  intervalText: { fontFamily: fonts.medium, fontSize: 13 },
  reminderHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.md,
  },
  sheetLabel: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  customInput: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 16,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { fontFamily: fonts.semibold, fontSize: 16 },
  cancelBtn: { height: 44, alignItems: "center", justifyContent: "center", marginTop: spacing.xs },
  cancelText: { fontFamily: fonts.medium, fontSize: 14 },
});
