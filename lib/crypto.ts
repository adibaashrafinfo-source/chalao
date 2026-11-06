import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Courier and channel keys are stored encrypted (AES-256-GCM) in the database.
 * The key comes from ENCRYPTION_KEY, or from AUTH_SECRET when that is not set. If it is
 * lost, saved courier keys cannot be read again and must be entered once more.
 */
function key(): Buffer {
  const secret = process.env["ENCRYPTION_KEY"] || process.env["AUTH_SECRET"];
  if (!secret) throw new Error("Set ENCRYPTION_KEY (or AUTH_SECRET) in the app's environment.");
  return createHash("sha256").update(secret).digest();
}

export function encryptJson(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(":");
}

export function decryptJson<T = Record<string, string>>(payload: string | null | undefined): T | null {
  if (!payload) return null;
  const [version, iv, tag, body] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !body) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const text = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export const randomToken = (bytes = 24) => randomBytes(bytes).toString("hex");
