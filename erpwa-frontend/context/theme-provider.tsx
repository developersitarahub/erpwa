"use client"

import type React from "react"
import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react"

type Theme = "light" | "dark"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Safe localStorage access
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    if (typeof window === "undefined") return null
    try {
      return window.localStorage.getItem(key)
    } catch (error) {
      console.warn("localStorage.getItem failed:", error)
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.setItem(key, value)
    } catch (error) {
      console.warn("localStorage.setItem failed:", error)
    }
  },
}

// Safe system preference detection
const getSystemPreference = (): Theme => {
  if (typeof window === "undefined") return "dark"
  try {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    return mediaQuery.matches ? "dark" : "light"
  } catch (error) {
    console.warn("matchMedia failed:", error)
    return "dark"
  }
}

// Get initial theme
const getInitialTheme = (): Theme => {
  if (typeof window === "undefined") return "dark"
  
  const savedTheme = safeLocalStorage.getItem("theme") as Theme | null
  if (savedTheme === "light" || savedTheme === "dark") {
    return savedTheme
  }
  
  return getSystemPreference()
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Initialize theme with lazy initializer (runs only once)
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [mounted, setMounted] = useState(false)

  // Use layout effect to prevent flash of wrong theme
  // Fallback to useEffect on server
  const useIsomorphicLayoutEffect = 
    typeof window !== "undefined" ? useLayoutEffect : useEffect

  // Mark as mounted after hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Apply theme to DOM (runs before paint with useLayoutEffect)
  useIsomorphicLayoutEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    
    // Remove both theme classes
    root.classList.remove("light", "dark")
    
    // Add current theme
    root.classList.add(theme)
    
    // Set data attribute for additional compatibility
    root.setAttribute("data-theme", theme)
    
    // Persist to localStorage
    safeLocalStorage.setItem("theme", theme)
  }, [theme, mounted])

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === "undefined") return

    let mediaQuery: MediaQueryList | null = null

    try {
      mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      
      const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
        // Only auto-update if user hasn't manually set a preference
        const savedTheme = safeLocalStorage.getItem("theme")
        if (!savedTheme) {
          setTheme(e.matches ? "dark" : "light")
        }
      }

      // Modern browsers (Chrome 76+, Safari 14+, Firefox 55+)
      if ("addEventListener" in mediaQuery) {
        mediaQuery.addEventListener("change", handleChange)
      } 
      // Legacy browsers (Safari < 14, IE, older Chrome/Firefox)
      else if ("addListener" in mediaQuery) {
        // @ts-expect-error - deprecated but needed for older browsers
        mediaQuery.addListener(handleChange)
      }

      // Cleanup
      return () => {
        if (!mediaQuery) return
        
        if ("removeEventListener" in mediaQuery) {
          mediaQuery.removeEventListener("change", handleChange)
        } else if ("removeListener" in mediaQuery) {
          // @ts-expect-error - removeListener is deprecated but needed for older Safari versions
          mediaQuery.removeListener(handleChange)
        }
      }
    } catch (error) {
      console.warn("System theme change listener failed:", error)
    }
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
