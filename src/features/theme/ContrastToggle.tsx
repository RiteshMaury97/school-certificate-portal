"use client";
import { Contrast } from "lucide-react";
import IconButton from "@/src/components/ui/IconButton";
import { useTheme } from "./ThemeProvider";
export default function ContrastToggle() {
  const { contrast, toggleContrast } = useTheme();
  return (
    <IconButton
      label={contrast ? "Disable high contrast" : "Enable high contrast"}
      aria-pressed={contrast}
      onClick={toggleContrast}
    >
      <Contrast size={19} aria-hidden="true" />
    </IconButton>
  );
}
