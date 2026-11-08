import english from "./messages/en.json";
import type { ReactNode } from "react";
export function LocaleProvider({ children }: { children: ReactNode }) { return <>{children}</>; }
export function useT() { return (key: string): string => { let value: unknown = english; for (const part of key.split(".")) { if (typeof value !== "object" || value === null || !(part in value)) return key; value = (value as Record<string, unknown>)[part]; } return typeof value === "string" ? value : key; }; }
