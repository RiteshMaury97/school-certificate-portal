"use client";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/src/lib/i18n";
export default function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const savedLanguage = localStorage.getItem("sis-language");
    if (savedLanguage === "hi" || savedLanguage === "en")
      void i18n.changeLanguage(savedLanguage);
    document.documentElement.lang = savedLanguage === "hi" ? "hi" : "en";
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const savedTheme = localStorage.getItem("sis-theme");
      const dark =
        savedTheme === "dark" || (savedTheme !== "light" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
    };
    applyTheme();
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, []);
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
