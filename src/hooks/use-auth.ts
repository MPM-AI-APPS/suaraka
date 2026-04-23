"use client";

import { useSession, signIn, signOut } from "next-auth/react";

export function useAuth() {
  const { data, status } = useSession();
  const user = data?.user ?? null;
  return {
    user,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    signIn: () => signIn("keycloak", { callbackUrl: "/library" }),
    signOut: () => signOut({ callbackUrl: "/login" }),
  };
}
