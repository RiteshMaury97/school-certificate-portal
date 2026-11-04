"use client";

import { useCallback, useMemo, useState } from "react";

import type { z } from "zod";

type Errors = Record<string, string>;

export function useFormValidation(schema: z.ZodType, values: unknown) {
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const result = useMemo(() => schema.safeParse(values), [schema, values]);
  const errors = useMemo<Errors>(() => {
    if (result.success) return {};
    return result.error.issues.reduce<Errors>((all, issue) => {
      const key = String(issue.path[0] ?? "form");
      if (submitted || touched.has(key)) all[key] ??= issue.message;
      return all;
    }, {});
  }, [result, submitted, touched]);

  const validate = useCallback((focusFirst = false) => {
    setSubmitted(true);
    const parsed = schema.safeParse(values);
    if (parsed.success) return true;
    if (focusFirst) {
      const first = String(parsed.error.issues[0]?.path[0] ?? "");
      if (first) requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(`[name="${CSS.escape(first)}"],#${CSS.escape(first)}`);
        target?.focus();
      });
    }
    return false;
  }, [schema, values]);

  const onBlur = useCallback((key: string) => () => {
    setTouched((current) => new Set(current).add(key));
  }, []);

  return { errors, validate, onBlur, isValid: result.success };
}
