"use client";

import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Safe localStorage access
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("localStorage.getItem failed:", error);
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn("localStorage.setItem failed:", error);
    }
  },
};

// Get initial theme
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const savedTheme = safeLocalStorage.getItem("theme") as Theme | null;
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme;
  }

  return "light"; // Default to light if no preference
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize theme with lazy initializer (runs only once)
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  // Use layout effect to prevent flash of wrong theme
  // Fallback to useEffect on server
  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  // Mark as mounted after hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply theme to DOM (runs before paint with useLayoutEffect)
  useIsomorphicLayoutEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;

    // Remove both theme classes
    root.classList.remove("light", "dark");

    // Add current theme
    root.classList.add(theme);

    // Set data attribute for additional compatibility
    root.setAttribute("data-theme", theme);

    // Persist to localStorage
    safeLocalStorage.setItem("theme", theme);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
