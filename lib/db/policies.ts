import "server-only";

import { poolDb } from "@/lib/db/db";

/**
 * Who may read and change which rows. These rules replace the row-level security
 * that used to live in the old hosted database. The query layer applies them to every
 * query made through the signed-in client; the admin client skips them.
 */
export type Access = "any" | "member" | "manager" | "owner" | "admin" | "self" | "none";

type Rule = { select: Access; insert: Access; update: Access; delete: Access };

const MEMBER_RW: Rule = { select: "member", insert: "member", update: "member", delete: "member" };
/** Written only by the server's own transactions, readable by members. */
const LEDGER: Rule = { select: "member", insert: "none", update: "none", delete: "none" };
const MANAGER_DELETE: Rule = { select: "member", insert: "member", update: "member", delete: "manager" };

export const POLICIES: Record<string, Rule> = {
  profiles: { select: "self", insert: "none", update: "self", delete: "none" },
  platform_admins: { select: "self", insert: "none", update: "none", delete: "none" },
  site_settings: { select: "any", insert: "none", update: "admin", delete: "none" },
  subscription_plans: { select: "any", insert: "admin", update: "admin", delete: "admin" },
  organizations: { select: "member", insert: "none", update: "owner", delete: "none" },
  organization_members: { select: "member", insert: "owner", update: "owner", delete: "owner" },
  organization_invitations: { select: "owner", insert: "owner", update: "owner", delete: "none" },
  organization_subscriptions: LEDGER,
  payment_submissions: LEDGER,
  subscription_payments: LEDGER,
  subscription_events: LEDGER,
  order_status_history: LEDGER,
  inventory_movements: LEDGER,
  shipment_events: LEDGER,
  messages: LEDGER,
  courier_payout_items: LEDGER,
  cod_unsettled_shipments: LEDGER,
  audit_events: LEDGER,
  order_returns: { select: "member", insert: "none", update: "member", delete: "none" },
  courier_payouts: { select: "member", insert: "none", update: "owner", delete: "owner" },
  order_confirmation_rules: { select: "member", insert: "owner", update: "owner", delete: "none" },
  conversations: { select: "member", insert: "none", update: "member", delete: "none" },
  products: MANAGER_DELETE,
  product_variants: MANAGER_DELETE,
  customers: MANAGER_DELETE,
  stores: MEMBER_RW,
  orders: MEMBER_RW,
  order_items: MEMBER_RW,
  channel_connections: MEMBER_RW,
  courier_accounts: MEMBER_RW,
  shipments: MEMBER_RW,
};

/** Columns the signed-in client can never read. Secrets are decrypted only on the server. */
export const HIDDEN_COLUMNS = new Set(["credentials_enc", "password_hash"]);

export type Scope = {
  userId: string | null;
  /** Skips every rule below (server-side jobs, webhooks, transactions). */
  unrestricted: boolean;
};

export type Memberships = Map<string, string>;

const memberCache = new WeakMap<Scope, Promise<{ orgs: Memberships; admin: boolean }>>();

export function loadMemberships(scope: Scope) {
  let cached = memberCache.get(scope);
  if (!cached) {
    cached = (async () => {
      if (!scope.userId) return { orgs: new Map<string, string>(), admin: false };
      const db = poolDb();
      const rows = await db.all<{ organization_id: string; role: string }>(
        "SELECT organization_id, role FROM organization_members WHERE user_id = ?",
        [scope.userId],
      );
      const admin = Boolean(await db.one("SELECT 1 AS x FROM platform_admins WHERE user_id = ? LIMIT 1", [scope.userId]));
      return { orgs: new Map(rows.map((r) => [r.organization_id, r.role] as const)), admin };
    })();
    memberCache.set(scope, cached);
  }
  return cached;
}

/** Forget what was loaded, e.g. right after the person joins or creates an organization. */
export function forgetMemberships(scope: Scope) {
  memberCache.delete(scope);
}

function orgsWithRole(orgs: Memberships, access: Access): string[] {
  const ids: string[] = [];
  for (const [id, role] of orgs) {
    if (access === "member") ids.push(id);
    else if (access === "manager" && (role === "owner" || role === "manager")) ids.push(id);
    else if (access === "owner" && role === "owner") ids.push(id);
  }
  return ids;
}

export type Op = "select" | "insert" | "update" | "delete";

/**
 * An SQL condition (with bound values) that limits a query to the rows this scope may
 * touch, or null when every row is allowed. `alias` is the table name used in the query.
 */
export async function rowCondition(
  scope: Scope,
  table: string,
  op: Op,
  alias: string,
): Promise<{ sql: string; params: unknown[] } | null> {
  if (scope.unrestricted) return null;

  const rule = POLICIES[table] ?? { select: "none", insert: "none", update: "none", delete: "none" };
  const access = rule[op];
  const none = { sql: "1 = 0", params: [] };

  if (access === "any") return null;
  if (access === "none") return none;

  const { orgs, admin } = await loadMemberships(scope);

  if (access === "admin") return admin ? null : none;

  if (access === "self") {
    if (!scope.userId) return none;
    if (table === "platform_admins") return { sql: `\`${alias}\`.\`user_id\` = ?`, params: [scope.userId] };
    if (table === "profiles" && op === "select") {
      // You can see your own profile and the profiles of people in your organizations.
      const mates = [...orgs.keys()];
      if (mates.length === 0) return { sql: `\`${alias}\`.\`id\` = ?`, params: [scope.userId] };
      return {
        sql: `(\`${alias}\`.\`id\` = ? OR \`${alias}\`.\`id\` IN (SELECT user_id FROM organization_members WHERE organization_id IN (${mates.map(() => "?").join(",")})))`,
        params: [scope.userId, ...mates],
      };
    }
    return { sql: `\`${alias}\`.\`id\` = ?`, params: [scope.userId] };
  }

  const ids = orgsWithRole(orgs, access);
  if (ids.length === 0) return none;
  const column = table === "organizations" ? "id" : "organization_id";
  return { sql: `\`${alias}\`.\`${column}\` IN (${ids.map(() => "?").join(",")})`, params: ids };
}

/** Whether a row about to be inserted passes the table's insert rule. */
export async function canInsertRow(scope: Scope, table: string, row: Record<string, unknown>): Promise<boolean> {
  if (scope.unrestricted) return true;

  const rule = POLICIES[table];
  if (!rule) return false;
  const access = rule.insert;
  if (access === "any") return true;
  if (access === "none") return false;

  const { orgs, admin } = await loadMemberships(scope);
  if (access === "admin") return admin;
  if (access === "self") return row["id"] === scope.userId;

  const organizationId = row["organization_id"];
  return typeof organizationId === "string" && orgsWithRole(orgs, access).includes(organizationId);
}
