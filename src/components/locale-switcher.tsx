"use client";

import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex items-center rounded-full border border-border/70 bg-card p-0.5">
      <Button
        size="sm"
        variant={locale === "en" ? "default" : "ghost"}
        className="h-7 rounded-full px-3 text-xs"
        onClick={() => setLocale("en")}
      >
        EN
      </Button>
      <Button
        size="sm"
        variant={locale === "id" ? "default" : "ghost"}
        className="h-7 rounded-full px-3 text-xs"
        onClick={() => setLocale("id")}
      >
        ID
      </Button>
    </div>
  );
}
