import "server-only";

import { cache } from "react";

import { getSessionUserId } from "@/lib/auth/session";
import { makeClient, type DbClient } from "@/lib/db/client";

/**
 * Database client that acts as the signed-in person: they only see and change what their
 * organization role allows. Use in Server Components, Server Actions and Route Handlers.
 * Still scope every query by organization_id explicitly.
 */
export const createClient = cache(async function createClient(): Promise<DbClient> {
  const userId = await getSessionUserId();
  return makeClient({ userId, unrestricted: false });
});

/**
 * Client that skips every permission rule. Only for work a signed-in person may not do
 * directly: reading courier credentials, and writing updates from courier webhooks
 * (which carry no login). Every query must scope organization_id itself.
 */
export function createAdminClient(): DbClient {
  return makeClient({ userId: null, unrestricted: true });
}

/** Whether a key for decrypting stored courier/channel credentials is configured. */
export function hasServiceRoleKey(): boolean {
  return Boolean(process.env["ENCRYPTION_KEY"] || process.env["AUTH_SECRET"]);
}
