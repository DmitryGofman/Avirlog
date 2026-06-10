import Slider from "@react-native-community/slider";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "@/src/context/ThemeContext";
import { ALL_TAGS, BreathLog, fonts, NostrilState, radius, spacing, STATE_META } from "@/src/theme/theme";

export interface LogFormPayload {
  nostril_state?: NostrilState;
  mood_score: number | null;
  energy_score: number | null;
  focus_score: number | null;
  note: string | null;
  tags: string[];
}

interface LogFormProps {
  initial?: Partial<BreathLog>;
  showStatePicker?: boolean;
  saving: boolean;
  onSave: (payload: LogFormPayload) => void;
  onSkip?: () => void;
  saveLabel?: string;
}

function ScoreRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: number | null;
  onChange: (v: number) => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreHeader}>
        <Text style={[styles.scoreLabel, { color: colors.onSurfaceSecondary }]}>{label}</Text>
        <Text style={[styles.scoreValue, { color: value ? colors.onSurface : colors.onSurfaceTertiary }]}>
          {value ?? "—"}
        </Text>
      </View>
      <Slider
        testID={testID}
        style={styles.slider}
        minimumValue={1}
        maximumValue={10}
        step={1}
        value={value ?? 5}
        onValueChange={onChange}
        minimumTrackTintColor={colors.brand}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.brand}
      />
    </View>
  );
}

export function LogForm({ initial, showStatePicker, saving, onSave, onSkip, saveLabel = "Save" }: LogFormProps) {
  const { colors } = useTheme();
  const [state, setState] = useState<NostrilState>(initial?.nostril_state ?? "left");
  const [mood, setMood] = useState<number | null>(initial?.mood_score ?? null);
  const [energy, setEnergy] = useState<number | null>(initial?.energy_score ?? null);
  const [focus, setFocus] = useState<number | null>(initial?.focus_score ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  const toggleTag = (tag: string) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const handleSave = () => {
    const payload: LogFormPayload = {
      mood_score: mood,
      energy_score: energy,
      focus_score: focus,
      note: note.trim() ? note.trim() : null,
      tags,
    };
    if (showStatePicker) payload.nostril_state = state;
    onSave(payload);
  };

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      {showStatePicker && (
        <View style={styles.statePickerRow}>
          {(Object.keys(STATE_META) as NostrilState[]).map((s) => {
            const meta = STATE_META[s];
            const selected = state === s;
            return (
              <Pressable
                key={s}
                testID={`log-form-state-${s}`}
                onPress={() => setState(s)}
                style={[
                  styles.stateOption,
                  {
                    backgroundColor: selected ? colors[meta.colorKey] : colors.surfaceTertiary,
                    borderColor: selected ? colors[meta.colorKey] : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.stateOptionText,
                    { color: selected ? colors[meta.onColorKey] : colors.onSurfaceTertiary },
                  ]}
                >
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <ScoreRow label="Mood" value={mood} onChange={setMood} testID="log-form-mood-slider" />
      <ScoreRow label="Energy" value={energy} onChange={setEnergy} testID="log-form-energy-slider" />
      <ScoreRow label="Focus" value={focus} onChange={setFocus} testID="log-form-focus-slider" />

      <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Tags</Text>
      <View style={styles.tagsWrap}>
        {ALL_TAGS.map((tag) => {
          const selected = tags.includes(tag);
          return (
            <Pressable
              key={tag}
              testID={`log-form-tag-${tag.toLowerCase()}`}
              onPress={() => toggleTag(tag)}
              style={[
                styles.tagPill,
                {
                  backgroundColor: selected ? colors.surfaceInverse : colors.surfaceTertiary,
                  borderColor: selected ? colors.surfaceInverse : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  { color: selected ? colors.onSurfaceInverse : colors.onSurfaceTertiary },
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.onSurfaceTertiary }]}>Note</Text>
      <TextInput
        testID="log-form-note-input"
        style={[
          styles.noteInput,
          {
            backgroundColor: colors.surfaceTertiary,
            color: colors.onSurface,
            borderColor: colors.border,
          },
        ]}
        placeholder="Anything worth remembering?"
        placeholderTextColor={colors.onSurfaceTertiary}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
      />

      <Pressable
        testID="log-form-save-button"
        onPress={handleSave}
        disabled={saving}
        style={[styles.saveBtn, { backgroundColor: colors.brandPrimary, opacity: saving ? 0.7 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.onBrandPrimary} />
        ) : (
          <Text style={[styles.saveText, { color: colors.onBrandPrimary }]}>{saveLabel}</Text>
        )}
      </Pressable>

      {onSkip && (
        <Pressable testID="log-form-skip-button" onPress={onSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.onSurfaceTertiary }]}>Skip details</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.sm },
  statePickerRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  stateOption: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stateOptionText: { fontFamily: fonts.semibold, fontSize: 14 },
  scoreRow: { marginBottom: spacing.md },
  scoreHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: { fontFamily: fonts.medium, fontSize: 14 },
  scoreValue: { fontFamily: fonts.semibold, fontSize: 16 },
  slider: { width: "100%", height: 36 },
  sectionLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  tagPill: {
    paddingHorizontal: spacing.lg,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tagText: { fontFamily: fonts.medium, fontSize: 13 },
  noteInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 72,
    padding: spacing.md,
    fontFamily: fonts.regular,
    fontSize: 14,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  saveBtn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontFamily: fonts.semibold, fontSize: 16 },
  skipBtn: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xs,
  },
  skipText: { fontFamily: fonts.medium, fontSize: 14 },
});
