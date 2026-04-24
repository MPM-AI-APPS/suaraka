"use client";

import { SessionProvider } from "next-auth/react";

const LOGIN_DISABLED = process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // When login is disabled, skip SessionProvider entirely so next-auth
  // doesn't attempt to fetch a session or require Keycloak to be configured.
  if (LOGIN_DISABLED) return <>{children}</>;
  return <SessionProvider>{children}</SessionProvider>;
}
