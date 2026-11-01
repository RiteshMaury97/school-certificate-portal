"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
type ThemeContextValue = { theme: ThemeMode; toggleTheme: () => void };

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "sis-theme";
let themeSnapshot: ThemeMode = "system";
const themeSubscribers = new Set<() => void>();

function readStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeStorage(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Storage may be unavailable (private mode). The choice then lasts for this visit only. */
  }
}

function subscribeToTheme(subscriber: () => void): () => void {
  themeSubscribers.add(subscriber);
  return () => {
    themeSubscribers.delete(subscriber);
  };
}
function getThemeSnapshot(): ThemeMode {
  return themeSnapshot;
}
function getServerThemeSnapshot(): ThemeMode {
  return "system";
}
function updateThemeSnapshot(theme: ThemeMode): void {
  themeSnapshot = theme;
  for (const subscriber of themeSubscribers) subscriber();
}
function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}
function applyTheme(mode: ThemeMode): void {
  const dark =
    mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.style.colorScheme = dark ? "dark" : "light";
}
/** Cross-fades colours for a moment so switching theme is smooth, not a flash. */
function applyThemeAnimated(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.add("theme-fade");
  applyTheme(mode);
  window.setTimeout(() => { root.classList.remove("theme-fade"); }, 360);
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error("useTheme must be used within ThemeProvider");
  return value;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  useEffect(() => {
    const saved = readStorage();
    updateThemeSnapshot(isThemeMode(saved) ? saved : "system");
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
      toggleTheme() {
        const next: ThemeMode =
          theme === "system" ? "light" : theme === "light" ? "dark" : "system";
        applyThemeAnimated(next);
        updateThemeSnapshot(next);
        writeStorage(next);
      },
    }),
    [theme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
