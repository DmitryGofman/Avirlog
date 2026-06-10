import React, { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/context/ThemeContext";
import { fonts, radius, spacing } from "@/src/theme/theme";

type ToastType = "success" | "error";

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [type, setType] = useState<ToastType>("success");
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const showToast = useCallback(
    (msg: string, t: ToastType = "success") => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(msg);
      setType(t);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() =>
          setMessage(null),
        );
      }, 2200);
    },
    [opacity],
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      <View style={styles.flex}>
        {children}
        {message !== null && (
          <Animated.View
            pointerEvents="none"
            testID="toast-message"
            style={[
              styles.toast,
              {
                top: insets.top + spacing.md,
                opacity,
                backgroundColor: type === "error" ? colors.error : colors.surfaceInverse,
              },
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: type === "error" ? colors.onError : colors.onSurfaceInverse },
              ]}
            >
              {message}
            </Text>
          </Animated.View>
        )}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toast: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
