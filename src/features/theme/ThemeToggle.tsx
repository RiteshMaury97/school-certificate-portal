"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

import IconButton from "@/components/ui/IconButton";

import { useTheme } from "./ThemeProvider";

function unsubscribeFromHydration(): void {
  // The hydration snapshot has no external subscription source.
}

function subscribeToHydration(): () => void {
  return unsubscribeFromHydration;
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getServerSnapshot(): boolean {
  return false;
}

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getHydratedSnapshot,
    getServerSnapshot,
  );

  if (!mounted) {
    return (
      <IconButton label="Theme settings loading" aria-pressed={false} disabled>
        <Monitor size={19} aria-hidden="true" />
      </IconButton>
    );
  }

  const label =
    theme === "system"
      ? "Theme: system. Switch to light theme"
      : theme === "light"
        ? "Theme: light. Switch to dark theme"
        : "Theme: dark. Switch to system theme";
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;

  return (
    <IconButton
      label={label}
      aria-pressed={theme !== "system"}
      onClick={toggleTheme}
    >
      <Icon size={19} aria-hidden="true" />
    </IconButton>
  );
}
