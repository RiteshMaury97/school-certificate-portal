"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import IconButton from "@/src/components/ui/IconButton";
import { useTheme } from "./ThemeProvider";
export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label =
    theme === "system"
      ? "Theme: system. Switch to light theme"
      : theme === "light"
        ? "Theme: light. Switch to dark theme"
        : "Theme: dark. Switch to system theme";
  const Icon = theme === "system" ? Monitor : theme === "light" ? Sun : Moon;
  return (
    <IconButton label={label} aria-pressed={theme !== "system"} onClick={toggleTheme}>
      <Icon size={19} aria-hidden="true" />
    </IconButton>
  );
}
