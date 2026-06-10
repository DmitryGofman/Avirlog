import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

import { api, setApiToken } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  auth_provider: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  processSessionId: (sessionId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "avirlog_token";

function extractSessionId(url: string | null): string | null {
  if (!url) return null;
  const hashMatch = url.match(/#.*session_id=([^&]+)/);
  if (hashMatch) return decodeURIComponent(hashMatch[1]);
  const queryMatch = url.match(/[?&]session_id=([^&#]+)/);
  if (queryMatch) return decodeURIComponent(queryMatch[1]);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const storeToken = async (token: string) => {
    setApiToken(token);
    await storage.secureSet(TOKEN_KEY, token);
  };

  const clearToken = async () => {
    setApiToken(null);
    await storage.secureRemove(TOKEN_KEY);
  };

  const processSessionId = useCallback(async (sessionId: string) => {
    const data = await api<{ session_token: string; user: User }>("/auth/session", {
      method: "POST",
      body: { session_id: sessionId },
    });
    await storeToken(data.session_token);
    setUser(data.user);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        // 1) Google redirect carrying session_id?
        if (Platform.OS === "web") {
          const sid =
            extractSessionId(window.location.hash) ?? extractSessionId(window.location.search);
          if (sid) {
            await processSessionId(sid);
            window.history.replaceState(null, "", window.location.pathname);
            return;
          }
        } else {
          const initialUrl = await Linking.getInitialURL();
          const sid = extractSessionId(initialUrl);
          if (sid) {
            await processSessionId(sid);
            return;
          }
        }
        // 2) Existing stored token
        const stored = await storage.secureGet<string | null>(TOKEN_KEY, null);
        if (stored) {
          setApiToken(stored);
          const me = await api<User>("/auth/me");
          if (!cancelled) setUser(me);
        }
      } catch {
        await clearToken();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();

    // Hot deep-link fallback (mobile)
    let sub: { remove: () => void } | undefined;
    if (Platform.OS !== "web") {
      sub = Linking.addEventListener("url", (event) => {
        const sid = extractSessionId(event.url);
        if (sid) processSessionId(sid).catch(() => {});
      });
    }

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [processSessionId]);

  const signIn = async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    await storeToken(data.token);
    setUser(data.user);
  };

  const signUp = async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: { email: email.trim().toLowerCase(), password },
    });
    await storeToken(data.token);
    setUser(data.user);
  };

  const signInWithGoogle = async () => {
    const redirectUrl =
      Platform.OS === "web" ? window.location.origin + "/" : Linking.createURL("auth");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web") {
      window.location.href = authUrl;
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type === "success" && result.url) {
      const sid = extractSessionId(result.url);
      if (sid) await processSessionId(sid);
    }
  };

  const signOut = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // best-effort
    }
    await clearToken();
    setUser(null);
  };

  const deleteAccount = async () => {
    await api("/auth/account", { method: "DELETE" });
    await clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signIn, signUp, signInWithGoogle, signOut, deleteAccount, processSessionId }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
