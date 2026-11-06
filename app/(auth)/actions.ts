"use server";

import { redirect } from "next/navigation";

import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { endSession, startSession } from "@/lib/auth/session";
import { newId, poolDb, withTx } from "@/lib/db/db";
import { getMessages } from "@/lib/i18n";
import { makeLoginSchema, makeSignupSchema } from "@/lib/validations/auth";

export type AuthResult = { error?: string; notice?: string };

const t = getMessages("en");

// Where to go after signing in. Only ever back to an invitation link — never an
// arbitrary address taken from the URL, which would make this an open redirect.
function safeNext(next: unknown): string | null {
  return typeof next === "string" && /^\/invite\/[a-f0-9]{48}$/.test(next) ? next : null;
}

/** Emails listed in ADMIN_EMAILS become platform admins the moment they sign in or sign up. */
async function grantAdminIfListed(userId: string, email: string) {
  const listed = (process.env["ADMIN_EMAILS"] ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!listed.includes(email.toLowerCase())) return;
  await poolDb().run("INSERT IGNORE INTO platform_admins (user_id) VALUES (?)", [userId]);
}

export async function signInAction(values: unknown, next?: string): Promise<AuthResult> {
  const parsed = makeLoginSchema(t.validation).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.auth.genericError };

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const db = poolDb();
    const user = await db.one<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = ?", [email]);

    // The same answer for "no such account" and "wrong password", so emails cannot be probed.
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      return { error: "Email or password is incorrect." };
    }

    await db.run("UPDATE users SET last_sign_in_at = UTC_TIMESTAMP(3) WHERE id = ?", [user.id]);
    await grantAdminIfListed(user.id, email);
    await startSession(user.id);
  } catch (error) {
    return { error: error instanceof Error ? error.message : t.auth.genericError };
  }

  redirect(safeNext(next) ?? "/dashboard");
}

export async function signUpAction(values: unknown, next?: string): Promise<AuthResult> {
  const parsed = makeSignupSchema(t.validation).safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? t.auth.genericError };

  const email = parsed.data.email.trim().toLowerCase();

  try {
    const exists = await poolDb().one("SELECT 1 AS x FROM users WHERE email = ?", [email]);
    if (exists) return { error: "An account with this email already exists. Try logging in." };

    const id = newId();
    const hash = await hashPassword(parsed.data.password);

    // The account and its profile are created together or not at all.
    await withTx(async (db) => {
      await db.run("INSERT INTO users (id, email, password_hash, last_sign_in_at) VALUES (?,?,?, UTC_TIMESTAMP(3))", [id, email, hash]);
      await db.run("INSERT INTO profiles (id, full_name) VALUES (?,?)", [id, parsed.data.fullName.trim() || null]);
    });

    await grantAdminIfListed(id, email);
    await startSession(id);
  } catch (error) {
    // Two sign-ups with the same email at the same moment: the database refuses the second.
    if ((error as { code?: string })?.code === "23505") return { error: "An account with this email already exists. Try logging in." };
    return { error: error instanceof Error ? error.message : t.auth.genericError };
  }

  // Someone arriving from an invitation joins that team instead of starting a business.
  redirect(safeNext(next) ?? "/onboarding");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/login");
}
