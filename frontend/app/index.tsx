import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/context/AuthContext";
import { fonts, radius, spacing } from "@/src/theme/theme";

const BG_URL =
  "https://images.unsplash.com/photo-1636837955417-2d8a4e49368f?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200";

const POINTS = [
  "Log nostril dominance",
  "Track energy, mood, and focus",
  "Discover daily patterns",
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Landing() {
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Staggered entrance: the brand settles first, the form follows.
  const heroIn = useRef(new Animated.Value(0)).current;
  const formIn = useRef(new Animated.Value(0)).current;
  const useNative = Platform.OS !== "web";

  useEffect(() => {
    Animated.stagger(140, [
      Animated.timing(heroIn, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      Animated.timing(formIn, {
        toValue: 1,
        duration: 620,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
    ]).start();
  }, [heroIn, formIn, useNative]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: "#1C1C1C" }]}>
        <ActivityIndicator color="#F7F7F5" />
      </View>
    );
  }

  if (user) return <Redirect href="/(tabs)/log" />;

  const submit = async () => {
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "signin") await signIn(email, password);
      else await signUp(email, password);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  const google = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("Google sign-in failed. Try again.");
    }
  };

  return (
    <View style={styles.root}>
      <Image source={{ uri: BG_URL }} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient
        colors={["rgba(28,28,28,0.35)", "rgba(28,28,28,0.85)", "rgba(28,28,28,0.97)"]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing.xxxl, paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: heroIn,
              transform: [
                { translateY: heroIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <Text testID="landing-app-name" style={styles.appName}>
            AvirLog
          </Text>
          <Text style={styles.subtitle}>Track your breath. Understand your state.</Text>
          <View style={styles.points}>
            {POINTS.map((p, i) => (
              <View key={p} style={styles.pointRow}>
                <Text style={styles.pointIndex}>{i + 1}</Text>
                <Text style={styles.pointText}>{p}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.form,
            {
              opacity: formIn,
              transform: [
                { translateY: formIn.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.modeRow}>
            <Pressable
              testID="auth-mode-signin"
              onPress={() => setMode("signin")}
              style={[styles.modeBtn, mode === "signin" && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === "signin" && styles.modeTextActive]}>
                Sign in
              </Text>
            </Pressable>
            <Pressable
              testID="auth-mode-signup"
              onPress={() => setMode("signup")}
              style={[styles.modeBtn, mode === "signup" && styles.modeBtnActive]}
            >
              <Text style={[styles.modeText, mode === "signup" && styles.modeTextActive]}>
                Create account
              </Text>
            </Pressable>
          </View>

          <TextInput
            testID="auth-email-input"
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="rgba(247,247,245,0.45)"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            testID="auth-password-input"
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="rgba(247,247,245,0.45)"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />

          {error && (
            <Text testID="auth-error-text" style={styles.error}>
              {error}
            </Text>
          )}

          <Pressable
            testID="auth-submit-button"
            onPress={submit}
            disabled={submitting}
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          >
            {submitting ? (
              <ActivityIndicator color="#1C1C1C" />
            ) : (
              <Text style={styles.submitText}>
                {mode === "signin" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable testID="auth-google-button" onPress={google} style={styles.googleBtn}>
            <Ionicons name="logo-google" size={18} color="#F7F7F5" />
            <Text style={styles.googleText}>Continue with Google</Text>
          </Pressable>
        </Animated.View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#1C1C1C" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl, justifyContent: "flex-end" },
  hero: { marginBottom: spacing.xxl },
  appName: {
    fontFamily: fonts.bold,
    fontSize: 44,
    color: "#F7F7F5",
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: "rgba(247,247,245,0.8)",
    marginTop: spacing.sm,
  },
  points: { marginTop: spacing.xl, gap: spacing.md },
  pointRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pointIndex: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: "#1C1C1C",
    backgroundColor: "#95A599",
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    overflow: "hidden",
  },
  pointText: { fontFamily: fonts.medium, fontSize: 15, color: "rgba(247,247,245,0.92)" },
  form: { gap: spacing.md },
  modeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(247,247,245,0.08)",
    borderRadius: radius.md,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  modeBtnActive: { backgroundColor: "#F7F7F5" },
  modeText: { fontFamily: fonts.medium, fontSize: 14, color: "rgba(247,247,245,0.7)" },
  modeTextActive: { color: "#1C1C1C" },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "rgba(247,247,245,0.08)",
    borderWidth: 1,
    borderColor: "rgba(247,247,245,0.15)",
    paddingHorizontal: spacing.lg,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: "#F7F7F5",
  },
  error: { fontFamily: fonts.medium, fontSize: 13, color: "#D99B95" },
  submitBtn: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: "#F7F7F5",
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { fontFamily: fonts.semibold, fontSize: 16, color: "#1C1C1C" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(247,247,245,0.15)" },
  dividerText: { fontFamily: fonts.regular, fontSize: 13, color: "rgba(247,247,245,0.5)" },
  googleBtn: {
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "rgba(247,247,245,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  googleText: { fontFamily: fonts.medium, fontSize: 15, color: "#F7F7F5" },
});
