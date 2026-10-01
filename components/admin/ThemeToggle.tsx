"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

/**
 * ThemeToggle — dark/light mode switch for the admin dashboard.
 *
 * Uses next-themes (already configured in app/layout.tsx with
 * ThemeProvider attribute="class" defaultTheme="dark").
 *
 * Renders a pill-shaped toggle with sun/moon icons. The toggle
 * smoothly transitions between modes. Mounted state check prevents
 * hydration mismatch (next-themes reads localStorage on mount).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Skeleton placeholder to prevent layout shift
    return (
      <div className="w-9 h-9 rounded-lg bg-surface border border-hairline" />
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative w-9 h-9 rounded-lg bg-surface border border-hairline flex items-center justify-center text-stone hover:text-ink hover:border-hairline-strong transition-all duration-normal"
    >
      <Sun
        size={16}
        className={`absolute transition-all duration-slow ${
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <Moon
        size={16}
        className={`absolute transition-all duration-slow ${
          isDark
            ? "rotate-0 scale-100 opacity-100"
            : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </button>
  );
}
