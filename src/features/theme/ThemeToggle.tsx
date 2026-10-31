"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import IconButton from "@/components/ui/IconButton";
import { useTheme } from "./ThemeProvider";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Keep server HTML and the first browser render identical. The provider may
  // restore localStorage while another route segment is still hydrating.
  useEffect(() => {
    setMounted(true);
  }, []);

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
