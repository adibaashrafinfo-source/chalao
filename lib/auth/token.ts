import { SignJWT, jwtVerify } from "jose";

/**
 * Signed login token kept in a cookie. Safe to import from middleware (runs on the edge),
 * so this file must not touch the database or Node-only modules.
 */
export const SESSION_COOKIE = "chalao_session";
export const SESSION_DAYS = 30;

function secretKey(): Uint8Array {
  const secret = process.env["AUTH_SECRET"];
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or too short. Set a random string of 32+ characters in the app's environment.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

/** The user id inside a valid, unexpired token, or null. */
export async function readSessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
