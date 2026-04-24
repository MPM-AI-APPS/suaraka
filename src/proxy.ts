import { auth } from "@/auth";

const PUBLIC_PATHS = ["/login", "/api/auth"];

export default auth((req) => {
  // When login is disabled, allow all requests through unconditionally
  if (process.env.NEXT_PUBLIC_DISABLE_LOGIN === "true") return;

  const { nextUrl } = req;
  const isPublic = PUBLIC_PATHS.some((p) => nextUrl.pathname.startsWith(p));
  if (isPublic) return;

  if (!req.auth) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)).*)"],
};
