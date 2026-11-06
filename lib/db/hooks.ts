/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { randomToken } from "@/lib/crypto";
import { checkViolation, DbError, denied } from "@/lib/db/errors";
import { withTx, type Db } from "@/lib/db/db";
import { loadMemberships, type Scope } from "@/lib/db/policies";
import { subscriptionState } from "@/lib/db/subscription";

/**
 * Rules the old database enforced with triggers, now run by the app around every
 * insert, update and delete made through the query builder.
 * Transactions in rpc.ts write with plain SQL, so these rules do not apply there.
 */

type Row = Record<string, any>;
type Action = "insert" | "update" | "delete";

export async function enforceUserLimit(db: Db, organizationId: string) {
  const limit = await db.one<{ user_limit: number | null }>(
    `SELECT p.user_limit FROM organization_subscriptions s
       JOIN subscription_plans p ON p.code = s.plan_code
      WHERE s.organization_id = ?`,
    [organizationId],
  );
  // No subscription yet: the organization is still being created.
  if (!limit || limit.user_limit === null) return;

  const count = await db.one<{ n: number }>("SELECT COUNT(*) AS n FROM organization_members WHERE organization_id = ?", [
    organizationId,
  ]);
  if (Number(count?.n ?? 0) >= limit.user_limit) {
    throw checkViolation(`USER_LIMIT_REACHED: this plan allows ${limit.user_limit} users`);
  }
}

async function enforceOrderPlan(db: Db, organizationId: string) {
  const state = await subscriptionState(db, organizationId);
  if (state === "suspended") throw checkViolation("SUBSCRIPTION_SUSPENDED");
  if (state === "expired") throw checkViolation("SUBSCRIPTION_EXPIRED");

  const plan = await db.one<{ order_limit: number | null }>(
    `SELECT p.order_limit FROM organization_subscriptions s
       JOIN subscription_plans p ON p.code = s.plan_code
      WHERE s.organization_id = ?`,
    [organizationId],
  );
  if (plan && plan.order_limit !== null) {
    const used = await db.one<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders
        WHERE organization_id = ? AND created_at >= DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')`,
      [organizationId],
    );
    if (Number(used?.n ?? 0) >= plan.order_limit) throw checkViolation("ORDER_LIMIT_REACHED");
  }
}

async function isManager(scope: Scope, organizationId: string): Promise<boolean> {
  if (scope.unrestricted) return true;
  const { orgs } = await loadMemberships(scope);
  const role = orgs.get(organizationId);
  return role === "owner" || role === "manager";
}

const APPEND_ONLY = new Set([
  "order_status_history",
  "inventory_movements",
  "shipment_events",
  "subscription_payments",
  "subscription_events",
]);

/** May change the values about to be written. Returns the values to write. */
export async function runBeforeWrite(
  db: Db,
  scope: Scope,
  table: string,
  action: Action,
  values: Row,
  old: Row | null,
): Promise<Row> {
  if (APPEND_ONLY.has(table) && action !== "insert") {
    throw checkViolation(`Table ${table} is append-only; ${action.toUpperCase()} is not allowed`);
  }

  switch (table) {
    case "orders": {
      if (action === "insert") {
        const organizationId = values["organization_id"] as string;
        // Server-side work (courier webhooks, admin tools) is not held to the seller's plan.
        if (!scope.unrestricted) await enforceOrderPlan(db, organizationId);
        if (values["order_number"] === undefined || values["order_number"] === null) {
          const next = await withTx(async (tx) => {
            await tx.run("UPDATE organizations SET order_seq = order_seq + 1 WHERE id = ?", [organizationId]);
            const row = await tx.one<{ order_seq: number }>("SELECT order_seq FROM organizations WHERE id = ?", [organizationId]);
            return Number(row?.order_seq ?? 0);
          });
          return { ...values, order_number: next };
        }
      }
      if (action === "update" && old && "status" in values && values["status"] !== old["status"]) {
        throw checkViolation("orders.status must be changed via transition_order_status()");
      }
      return values;
    }

    case "product_variants": {
      if (action === "update" && old) {
        if ("stock" in values && Number(values["stock"]) !== Number(old["stock"])) {
          throw checkViolation("product_variants.stock must be changed via apply_inventory_movement()");
        }
        if (
          "selling_price" in values &&
          Number(values["selling_price"]) !== Number(old["selling_price"]) &&
          !(await isManager(scope, old["organization_id"]))
        ) {
          throw denied("ROLE_DENIED: only a manager or the owner can change a selling price");
        }
      }
      return values;
    }

    case "organization_members": {
      if (action === "insert") await enforceUserLimit(db, values["organization_id"] as string);
      if (action === "delete" && old?.["role"] === "owner") {
        throw new DbError("The owner cannot be removed from the team", "23001");
      }
      if (action === "update" && old && "role" in values) {
        if (old["role"] === "owner" && values["role"] !== "owner") {
          throw new DbError("The owner cannot be given another role", "23001");
        }
        if (old["role"] !== "owner" && values["role"] === "owner") {
          throw new DbError("Ownership cannot be given away from the team screen", "23001");
        }
      }
      return values;
    }

    case "messages": {
      if (action === "delete") throw new DbError("Messages cannot be deleted", "23001");
      if (action === "update" && old) {
        for (const column of ["body", "direction", "author", "conversation_id", "attachments"]) {
          if (column in values && JSON.stringify(values[column]) !== JSON.stringify(old[column] ?? null)) {
            // Stored JSON is compared as text, so only a real change gets here.
            if (column === "attachments" && JSON.stringify(old[column]) === JSON.stringify(safeParse(values[column]))) continue;
            throw new DbError("A message cannot be edited after it is stored", "23001");
          }
        }
      }
      return values;
    }

    case "courier_payout_items": {
      if (action === "update") throw new DbError("A payout line cannot be edited. Remove the payout and record it again.", "23001");
      if (action === "insert") return withNet(values);
      return values;
    }

    case "order_returns": {
      if (action === "update" && old && ("order_id" in values || "organization_id" in values)) {
        throw new DbError("A return stays with its order", "23001");
      }
      return values;
    }

    case "channel_connections":
    case "courier_accounts": {
      if (action === "insert" && !values["webhook_token"]) return { ...values, webhook_token: randomToken(24) };
      return values;
    }

    default:
      return values;
  }
}

function safeParse(value: unknown) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function withNet(values: Row): Row {
  const cod = Number(values["cod_amount"] ?? 0);
  const delivery = Number(values["delivery_charge"] ?? 0);
  const fee = Number(values["cod_fee"] ?? 0);
  const adjustment = Number(values["adjustment"] ?? 0);
  return { ...values, net_amount: Math.round((cod - delivery - fee + adjustment) * 100) / 100 };
}
