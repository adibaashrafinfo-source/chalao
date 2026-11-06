import { NextResponse, type NextRequest } from "next/server";

import { readSessionToken, SESSION_COOKIE } from "@/lib/auth/token";

// Routes that require a signed-in user. Organization membership is checked in the
// (dashboard) layout, which redirects to /onboarding when it is missing.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/cod",
  "/returns",
  "/profit",
  "/inbox",
  "/orders",
  "/customers",
  "/products",
  "/inventory",
  "/couriers",
  "/settings",
  "/onboarding",
  "/admin",
];

const AUTH_PAGES = ["/login", "/signup"];

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Marketing pages don't depend on who is looking.
  if (!isProtected && !isAuthPage) return NextResponse.next({ request });

  // The cookie is signed, so checking it needs no database call.
  let userId: string | null = null;
  try {
    userId = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  } catch {
    // AUTH_SECRET missing: treat as signed out; the login page will explain.
  }

  if (!userId && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (userId && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
