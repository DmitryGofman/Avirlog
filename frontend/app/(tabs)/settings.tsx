import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
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

import { Sheet } from "@/src/components/Sheet";
import { useToast } from "@/src/components/Toast";
import { useAuth } from "@/src/context/AuthContext";
import { useTheme } from "@/src/context/ThemeContext";
import { api } from "@/src/lib/api";
import { fonts, radius, spacing } from "@/src/theme/theme";

interface Settings {
  reminder_enabled: boolean;
  reminder_interval_minutes: number;
  theme: "light" | "dark";
}

const INTERVALS = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useTheme();
  const { user, signOut, deleteAccount } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    api<Settings>("/settings")
      .then(setSettings)
      .catch(() => showToast("Could not load settings", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const toggleReminders = (enabled: boolean) => {
    if (!settings) return;
    persist({ ...settings, reminder_enabled: enabled });
  };

  const setInterval = (minutes: number) => {
    if (!settings) return;
    persist({ ...settings, reminder_interval_minutes: minutes });
  };

  const saveCustom = () => {
    const v = parseInt(customValue, 10);
    if (isNaN(v) || v < 5 || v > 1440) {
      showToast("Enter minutes between 5 and 1440", "error");
      return;
    }
    setInterval(v);
    setCustomOpen(false);
    showToast("Reminder interval saved");
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

  const isPresetInterval = INTERVALS.some((i) => i.value === settings?.reminder_interval_minutes);

  const Row = ({
    icon,
    label,
    right,
    onPress,
    testID,
    danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    right?: React.ReactNode;
    onPress?: () => void;
    testID: string;
    danger?: boolean;
  }) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed && onPress ? 0.7 : 1 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: colors.brandTertiary }]}>
        <Ionicons name={icon} size={16} color={danger ? colors.error : colors.onBrandTertiary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? colors.error : colors.onSurface }]}>
        {label}
      </Text>
      <View style={styles.rowRight}>{right}</View>
    </Pressable>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.onSurfaceTertiary }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Section title="Account">
          <Row
            icon="person-outline"
            label={user?.email ?? ""}
            testID="settings-email-row"
            right={
              <Text style={[styles.providerText, { color: colors.onSurfaceTertiary }]}>
                {user?.auth_provider === "google" ? "Google" : "Email"}
              </Text>
            }
          />
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
              <View style={styles.intervalRow}>
                {INTERVALS.map((i) => {
                  const selected = settings.reminder_interval_minutes === i.value;
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
                    setCustomValue(String(settings.reminder_interval_minutes));
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
                    {!isPresetInterval ? `${settings.reminder_interval_minutes} min` : "Custom"}
                  </Text>
                </Pressable>
              </View>
              <Text style={[styles.reminderHint, { color: colors.onSurfaceTertiary }]}>
                “Check your breath. What state are you in?” — reminder preferences are saved to your
                profile. Push delivery requires a native build.
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
        </Section>

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
      </ScrollView>

      <Sheet visible={customOpen} onClose={() => setCustomOpen(false)} title="Custom interval">
        <Text style={[styles.sheetLabel, { color: colors.onSurfaceTertiary }]}>
          Minutes between reminders (5–1440)
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
          placeholder="45"
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
