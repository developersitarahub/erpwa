"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import api, { setAccessToken } from "@/lib/api";
import { connectSocket, disconnectSocket } from "@/lib/socket";

/* ================= TYPES ================= */

export type User = {
  id: string;
  name: string;
  email: string;
  role: "vendor_owner" | "vendor_admin" | "sales" | "owner";
  vendorId: string | null;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

/* ================= CONTEXT ================= */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* ================= PROVIDER ================= */

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(false);

  /* ================= RESTORE SESSION ================= */

  useEffect(() => {
    mountedRef.current = true;

    const restoreSession = async () => {
      try {
        const res = await api.get("/auth/me");

        if (!mountedRef.current) return;

        setUser(res.data.user);

        // 🔐 CONNECT SOCKET AFTER SESSION RESTORE
        connectSocket();
      } catch {
        setAccessToken(null);
        if (mountedRef.current) {
          setUser(null);
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ================= GLOBAL LOGOUT LISTENER ================= */

  useEffect(() => {
    const handleLogout = () => {
      disconnectSocket(); // 🔥 IMPORTANT
      setAccessToken(null);
      setUser(null);

      const publicPaths = [
        "/login",
        "/forgot-password",
        "/create-password",
        "/privacy-policy",
        "/terms-n-condition",
      ];
      if (!publicPaths.includes(pathname)) {
        router.replace("/login");
      }
    };

    window.addEventListener("auth:logout", handleLogout);

    return () => {
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, [router, pathname]);

  /* ================= LOGIN ================= */

  async function login(email: string, password: string) {
    const res = await api.post("/auth/login", { email, password });

    const loggedInUser: User = res.data.user;

    setAccessToken(res.data.accessToken);
    setUser(loggedInUser);

    // 🔐 CONNECT SOCKET AFTER LOGIN
    connectSocket();

    // ✅ ROLE-BASED REDIRECT
    if (
      loggedInUser.role === "vendor_owner" ||
      loggedInUser.role === "vendor_admin"
    ) {
      router.replace("/admin/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }

  /* ================= LOGOUT ================= */

  async function logout() {
    try {
      await api.post("/auth/logout");
    } finally {
      disconnectSocket(); // 🔥 IMPORTANT
      setAccessToken(null);
      setUser(null);
      router.replace("/login");
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ================= HOOK ================= */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
