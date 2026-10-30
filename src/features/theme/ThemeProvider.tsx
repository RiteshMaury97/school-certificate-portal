"use client";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
export type ThemeMode = "system" | "light" | "dark";
type ThemeContextValue = {
  theme: ThemeMode;
  contrast: boolean;
  toggleTheme: () => void;
  toggleContrast: () => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage may be unavailable. */
  }
}
function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}
export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [contrast, setContrast] = useState(false);
  useEffect(() => {
    const saved = readStorage("sis-theme");
    setTheme(saved === "light" || saved === "dark" || saved === "system" ? saved : "system");
    const highContrast = readStorage("sis-high-contrast") === "true";
    setContrast(highContrast);
    document.documentElement.dataset.contrast = highContrast ? "high" : "normal";
  }, []);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => { applyTheme("system"); };
    media.addEventListener("change", update);
    return () => { media.removeEventListener("change", update); };
  }, [theme]);
  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      contrast,
      toggleTheme() {
        const next: ThemeMode =
          theme === "system" ? "light" : theme === "light" ? "dark" : "system";
        setTheme(next);
        writeStorage("sis-theme", next);
      },
      toggleContrast() {
        const next = !contrast;
        setContrast(next);
        writeStorage("sis-high-contrast", String(next));
        document.documentElement.dataset.contrast = next ? "high" : "normal";
      },
    }),
    [theme, contrast],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
