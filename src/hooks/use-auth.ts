"use client";

import { useSession, signIn, signOut } from "next-auth/react";

const LOGIN_DISABLED = process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true";

const GUEST_USER = {
  id: "local-user",
  email: "local@suaraka.local",
  name: "Reader",
  image: null as string | null,
};

export function useAuth() {
  // No-auth mode: return a static guest identity, skip next-auth entirely
  if (LOGIN_DISABLED) {
    return {
      user: GUEST_USER,
      isLoading: false,
      isAuthenticated: true,
      signIn: () => {},
      signOut: () => {},
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
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
