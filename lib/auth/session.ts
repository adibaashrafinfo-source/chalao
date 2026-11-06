import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { poolDb } from "@/lib/db/db";
import { readSessionToken, SESSION_COOKIE, SESSION_DAYS, signSessionToken } from "@/lib/auth/token";

export type SessionUser = {
  id: string;
  email: string;
  user_metadata: { full_name?: string };
};

function cookieSecure(): boolean {
  const flag = process.env["COOKIE_SECURE"];
  if (flag === "false") return false;
  if (flag === "true") return true;
  return (process.env["SITE_URL"] ?? "").startsWith("https://");
}

/** Signs the person in: sets the login cookie. Call from a server action or route handler. */
export async function startSession(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: cookieSecure(), path: "/", maxAge: 0 });
}

/** The user id from the cookie alone, with no database call. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/** The signed-in user, fetched once per request. Null when signed out or the account is gone. */
export const getCurrentUser = cache(async function getCurrentUser(): Promise<SessionUser | null> {
  const id = await getSessionUserId();
  if (!id) return null;

  const row = await poolDb().one<{ id: string; email: string; full_name: string | null }>(
    `SELECT u.id, u.email, p.full_name
       FROM users u LEFT JOIN profiles p ON p.id = u.id
      WHERE u.id = ? LIMIT 1`,
    [id],
  );
  if (!row) return null;

  return { id: row.id, email: row.email, user_metadata: row.full_name ? { full_name: row.full_name } : {} };
});
