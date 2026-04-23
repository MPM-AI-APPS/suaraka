"use client";

import * as React from "react";
import { DEFAULT_LOCALE, dict, type Dict, type Locale } from "@/lib/i18n";

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Dict;
}
const I18nCtx = React.createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(DEFAULT_LOCALE);

  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("suaraka:locale") : null;
    if (saved === "en" || saved === "id") setLocaleState(saved);
  }, []);

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("suaraka:locale", l);
  }, []);

  const value = React.useMemo<Ctx>(
    () => ({ locale, setLocale, t: dict[locale] }),
    [locale, setLocale]
  );
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = React.useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
