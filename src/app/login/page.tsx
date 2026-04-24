"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-provider";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Headphones } from "lucide-react";

const LOGIN_DISABLED = process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true";

function LoginInner() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const callbackUrl = sp.get("callbackUrl") || "/library";

  // When login is disabled, immediately send users to the library
  useEffect(() => {
    if (LOGIN_DISABLED) router.replace("/library");
  }, [router]);

  if (LOGIN_DISABLED) return null;

  return (
    <main className="suaraka-page flex min-h-screen items-center justify-center p-6">
      <div className="absolute right-6 top-6 flex gap-2">
        <ThemeSwitcher />
        <LocaleSwitcher />
      </div>
      <Card className="suaraka-glass suaraka-reveal w-full max-w-md border-border/70">
        <CardHeader className="items-center text-center">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Headphones />
          </div>
          <CardTitle className="font-heading text-2xl">{t.login.title}</CardTitle>
          <CardDescription>{t.login.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={() => signIn("keycloak", { callbackUrl })}
          >
            {t.login.signIn}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t.tagline}
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
