/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { decryptJson, encryptJson } from "@/lib/crypto";
import { toDbDateTime } from "@/lib/db/convert";
import { newId, withTx, type Db } from "@/lib/db/db";
import { checkViolation, DbError, denied, notFound, toDbError } from "@/lib/db/errors";
import { enforceUserLimit } from "@/lib/db/hooks";
import { getMeta } from "@/lib/db/meta";
import { fromDbRow } from "@/lib/db/convert";
import { loadMemberships, forgetMemberships, HIDDEN_COLUMNS, type Scope } from "@/lib/db/policies";
import { GRACE_DAYS, stateOf, subscriptionState, todayUtc } from "@/lib/db/subscription";

/**
 * The business functions the app used to call in the old database (`rpc("name", args)`),
 * written as TypeScript. Each one runs inside a single MySQL transaction, so a
 * failure part-way leaves nothing half-done. Argument names keep their old `p_` form.
 */

type Ctx = { db: Db; scope: Scope; userId: string | null; service: boolean };
type Args = Record<string, any>;
type Handler = (ctx: Ctx, args: Args) => Promise<any>;

// ---------------------------------------------------------------- helpers

const iso = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return `${s.replace(" ", "T")}Z`;
  return s;
};

const blank = (v: any): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const num = (v: any): number => Number(v ?? 0);
const json = (v: any) => (v === null || v === undefined ? null : JSON.stringify(v));
const monthStart = "DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-01')";

async function loadRow(db: Db, table: string, id: string): Promise<Record<string, any> | null> {
  const meta = await getMeta();
  const info = meta.tables.get(table);
  const pk = info?.primaryKey[0] ?? "id";
  const row = await db.one<Record<string, any>>(`SELECT * FROM \`${table}\` WHERE \`${pk}\` = ?`, [id]);
  if (!row) return null;
  const converted = fromDbRow(info, row);
  for (const hidden of HIDDEN_COLUMNS) delete converted[hidden];
  return converted;
}

async function isMember(ctx: Ctx, organizationId: string | null | undefined): Promise<boolean> {
  if (ctx.service) return true;
  if (!organizationId) return false;
  const { orgs } = await loadMemberships(ctx.scope);
  return orgs.has(organizationId);
}

async function roleIn(ctx: Ctx, organizationId: string): Promise<string | null> {
  const { orgs } = await loadMemberships(ctx.scope);
  return orgs.get(organizationId) ?? null;
}

async function requireMember(ctx: Ctx, organizationId: string | null | undefined) {
  if (!(await isMember(ctx, organizationId))) throw denied("Not a member of this organization");
}

async function isPlatformAdmin(ctx: Ctx): Promise<boolean> {
  if (ctx.service) return true;
  return (await loadMemberships(ctx.scope)).admin;
}

async function requireAdmin(ctx: Ctx) {
  if (!(await isPlatformAdmin(ctx))) throw denied("Platform admin only");
}

async function firstOrganizationId(ctx: Ctx): Promise<string | null> {
  if (!ctx.userId) return null;
  const row = await ctx.db.one<{ organization_id: string }>(
    "SELECT organization_id FROM organization_members WHERE user_id = ? ORDER BY created_at LIMIT 1",
    [ctx.userId],
  );
  return row?.organization_id ?? null;
}

// ---------------------------------------------------------------- stock and orders

const NEXT: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["ready_to_ship"],
  ready_to_ship: ["shipped"],
  shipped: ["delivered", "returned"],
  delivered: ["refunded"],
};

async function applyMovement(
  ctx: Ctx,
  variantId: string,
  type: string,
  change: number,
  orderId: string | null,
  note: string | null,
) {
  if (change === 0) throw checkViolation("quantity_change must not be zero");

  const variant = await ctx.db.one<{ organization_id: string; stock: number }>(
    "SELECT organization_id, stock FROM product_variants WHERE id = ? FOR UPDATE",
    [variantId],
  );
  if (!variant) throw notFound(`Variant ${variantId} not found`);
  await requireMember(ctx, variant.organization_id);

  if (type === "manual_adjustment" && !blank(note)) throw checkViolation("manual_adjustment requires a note");

  const after = Number(variant.stock) + change;
  if (after < 0) {
    throw checkViolation(`Insufficient stock: ${variant.stock} available, ${Math.abs(change)} requested`);
  }

  await ctx.db.run("UPDATE product_variants SET stock = ? WHERE id = ?", [after, variantId]);

  const id = newId();
  await ctx.db.run(
    `INSERT INTO inventory_movements
       (id, organization_id, variant_id, movement_type, quantity_change, stock_after, order_id, note, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [id, variant.organization_id, variantId, type, change, after, orderId, blank(note), ctx.userId],
  );
  return loadRow(ctx.db, "inventory_movements", id);
}

async function transition(ctx: Ctx, orderId: string, newStatus: string, note: string | null) {
  const order = await ctx.db.one<Record<string, any>>("SELECT * FROM orders WHERE id = ? FOR UPDATE", [orderId]);
  if (!order) throw notFound(`Order ${orderId} not found`);
  await requireMember(ctx, order["organization_id"]);

  const from = order["status"] as string;
  if (!NEXT[from]?.includes(newStatus)) {
    throw checkViolation(`Invalid order status transition: ${from} -> ${newStatus}`);
  }

  if (newStatus === "cancelled" && !ctx.service) {
    const role = await roleIn(ctx, order["organization_id"]);
    if (role !== "owner" && role !== "manager") {
      throw denied("ROLE_DENIED: only a manager or the owner can cancel an order");
    }
  }

  const items = await ctx.db.all<{ variant_id: string; quantity: number }>(
    "SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL",
    [orderId],
  );

  if (newStatus === "confirmed") {
    for (const item of items) {
      await applyMovement(ctx, item.variant_id, "order_out", -item.quantity, orderId, "Order confirmed");
    }
  } else if ((newStatus === "cancelled" || newStatus === "returned") && from !== "new") {
    for (const item of items) {
      await applyMovement(ctx, item.variant_id, "order_return", item.quantity, orderId, `Order ${newStatus}`);
    }
  }

  await ctx.db.run(
    `UPDATE orders SET status = ?,
       confirmed_at = CASE WHEN ? = 'confirmed' THEN UTC_TIMESTAMP(3) ELSE confirmed_at END,
       shipped_at   = CASE WHEN ? = 'shipped'   THEN UTC_TIMESTAMP(3) ELSE shipped_at END,
       delivered_at = CASE WHEN ? = 'delivered' THEN UTC_TIMESTAMP(3) ELSE delivered_at END
     WHERE id = ?`,
    [newStatus, newStatus, newStatus, newStatus, orderId],
  );

  await ctx.db.run(
    `INSERT INTO order_status_history (id, organization_id, order_id, from_status, to_status, note, changed_by)
     VALUES (?,?,?,?,?,?,?)`,
    [newId(), order["organization_id"], orderId, from, newStatus, blank(note), ctx.userId],
  );

  return loadRow(ctx.db, "orders", orderId);
}

// ---------------------------------------------------------------- risk and confirmation rules

async function customerRisk(ctx: Ctx, customerId: string | null) {
  if (customerId && !ctx.service) {
    const c = await ctx.db.one<{ organization_id: string }>("SELECT organization_id FROM customers WHERE id = ?", [customerId]);
    if (c && !(await isMember(ctx, c.organization_id))) throw denied("Not a member of this organization");
  }

  const r = await ctx.db.one<any>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'delivered'), 0) AS delivered,
            COALESCE(SUM(status IN ('returned','refunded')), 0) AS returned,
            COALESCE(SUM(status = 'cancelled'), 0) AS cancelled
       FROM orders WHERE customer_id = ?`,
    [customerId],
  );
  const total = num(r?.total);
  const delivered = num(r?.delivered);
  const returned = num(r?.returned);
  const cancelled = num(r?.cancelled);

  // Parcels that reached a conclusion at the courier. An order still in flight says nothing yet.
  const settled = delivered + returned;
  const returnRate = settled > 0 ? returned / settled : 0;
  const cancelRate = total > 0 ? cancelled / total : 0;
  const score = Math.round(returnRate * 70 + cancelRate * 30);

  let level: string;
  if (total === 0) level = "new";
  else if (settled === 0 && total < 3) level = "new";
  else if (settled >= 2 && returnRate >= 0.4) level = "high";
  else if (settled >= 1 && returnRate >= 0.2) level = "watch";
  else if (total >= 3 && cancelRate >= 0.4) level = "watch";
  else level = "good";

  return {
    level,
    score,
    total_orders: total,
    delivered,
    returned,
    cancelled,
    settled,
    return_rate: Math.round(returnRate * 100),
    cancel_rate: Math.round(cancelRate * 100),
  };
}

async function confirmationDecision(ctx: Ctx, orderId: string) {
  const order = await ctx.db.one<any>("SELECT * FROM orders WHERE id = ?", [orderId]);
  if (!order) return { action: "manual", advice: [], blockers: [] };
  if (!ctx.service && !(await isMember(ctx, order.organization_id))) {
    return { action: "manual", advice: [], blockers: [] };
  }

  const rules = await ctx.db.one<any>("SELECT * FROM order_confirmation_rules WHERE organization_id = ?", [order.organization_id]);
  const risk = await customerRisk(ctx, order.customer_id);
  const level = risk.level;
  const total = num(order.total);

  const advice: string[] = [];
  const blockers: string[] = [];

  if (level === "high") advice.push("take_advance");
  else if (level === "watch") advice.push("call_to_confirm");

  if (rules?.advance_payment_above !== null && rules?.advance_payment_above !== undefined) {
    if (total > num(rules.advance_payment_above) && !advice.includes("take_advance")) advice.push("large_order");
  }

  if (!rules || !rules.auto_confirm_enabled) {
    blockers.push("auto_off");
  } else {
    if (level === "high" || level === "watch") blockers.push(`risk_${level}`);
    if (level === "new" && !rules.auto_confirm_new_customers) blockers.push("new_customer");
    if (rules.auto_confirm_max_total !== null && total > num(rules.auto_confirm_max_total)) blockers.push("over_cap");
    if (rules.advance_payment_above !== null && total > num(rules.advance_payment_above)) blockers.push("needs_advance");
  }

  return {
    action: blockers.length === 0 ? "auto" : "manual",
    advice,
    blockers,
    risk_level: level,
    risk,
    total,
    status: order.status,
  };
}

// ---------------------------------------------------------------- subscriptions

async function ordersThisMonth(db: Db, organizationId: string): Promise<number> {
  const r = await db.one<{ n: number }>(
    `SELECT COUNT(*) AS n FROM orders WHERE organization_id = ? AND created_at >= ${monthStart}`,
    [organizationId],
  );
  return num(r?.n);
}

async function recordPayment(
  ctx: Ctx,
  a: { org: string; plan: string; months: number; amount: number; method: string; txn: string | null; submissionId: string | null; note: string | null },
) {
  if (!a.months || a.months < 1) throw checkViolation("Months must be at least 1");

  let sub = await ctx.db.one<any>("SELECT * FROM organization_subscriptions WHERE organization_id = ? FOR UPDATE", [a.org]);
  if (!sub) {
    await ctx.db.run("INSERT INTO organization_subscriptions (organization_id, plan_code) VALUES (?,?)", [a.org, a.plan]);
    sub = await ctx.db.one<any>("SELECT * FROM organization_subscriptions WHERE organization_id = ? FOR UPDATE", [a.org]);
  }

  const today = todayUtc();
  const current = sub.current_period_end ? String(sub.current_period_end).slice(0, 10) : today;
  const start = current > today ? current : today;
  const endRow = await ctx.db.one<{ d: string }>("SELECT DATE_FORMAT(DATE_ADD(?, INTERVAL ? MONTH), '%Y-%m-%d') AS d", [start, a.months]);
  const end = endRow!.d;

  await ctx.db.run(
    `UPDATE organization_subscriptions
        SET plan_code = ?, status = 'active',
            current_period_start = COALESCE(current_period_start, ?), current_period_end = ?
      WHERE organization_id = ?`,
    [a.plan, today, end, a.org],
  );

  const id = newId();
  await ctx.db.run(
    `INSERT INTO subscription_payments
       (id, organization_id, submission_id, plan_code, months, amount, method, transaction_id, period_start, period_end, recorded_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, a.org, a.submissionId, a.plan, a.months, a.amount, a.method, blank(a.txn), start, end, ctx.userId],
  );

  await ctx.db.run(
    "INSERT INTO subscription_events (id, organization_id, event_type, detail, note, actor) VALUES (?,?,?,?,?,?)",
    [
      newId(),
      a.org,
      "payment_recorded",
      json({ plan: a.plan, months: a.months, amount: a.amount, method: a.method, period_end: end }),
      a.note,
      ctx.userId,
    ],
  );
  return loadRow(ctx.db, "subscription_payments", id);
}

async function listOrganizations(ctx: Ctx, search: string | null) {
  const rows = await ctx.db.all<any>(
    `SELECT o.id AS organization_id, o.name, o.business_type, o.created_at,
            (SELECT u.email FROM organization_members m JOIN users u ON u.id = m.user_id
              WHERE m.organization_id = o.id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_email,
            (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id) AS member_count,
            COALESCE(s.plan_code, 'free') AS plan_code,
            COALESCE(p.name, 'Free') AS plan_name,
            COALESCE(p.monthly_price, 0) AS monthly_price,
            p.order_limit,
            COALESCE(s.status, 'active') AS status,
            s.current_period_end AS period_end,
            (SELECT COUNT(*) FROM orders x WHERE x.organization_id = o.id AND x.created_at >= ${monthStart}) AS orders_this_month,
            (SELECT COUNT(*) FROM orders x WHERE x.organization_id = o.id) AS orders_total,
            (SELECT COUNT(*) FROM payment_submissions ps WHERE ps.organization_id = o.id AND ps.status = 'pending') AS pending_submissions,
            (s.organization_id IS NOT NULL) AS has_subscription
       FROM organizations o
       LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
       LEFT JOIN subscription_plans p ON p.code = s.plan_code
      ORDER BY o.created_at DESC`,
  );

  const term = (search ?? "").trim().toLowerCase();
  return rows
    .filter(
      (r) =>
        !term ||
        String(r.name).toLowerCase().includes(term) ||
        String(r.owner_email ?? "").toLowerCase().includes(term),
    )
    .map((r) => ({
      organization_id: r.organization_id,
      name: r.name,
      business_type: r.business_type,
      created_at: iso(r.created_at),
      owner_email: r.owner_email,
      member_count: num(r.member_count),
      plan_code: r.plan_code,
      plan_name: r.plan_name,
      monthly_price: num(r.monthly_price),
      order_limit: r.order_limit === null ? null : num(r.order_limit),
      status: r.status,
      state: r.has_subscription
        ? stateOf({ status: r.status, current_period_end: r.period_end, monthly_price: num(r.monthly_price) })
        : "expired",
      period_end: r.period_end,
      orders_this_month: num(r.orders_this_month),
      orders_total: num(r.orders_total),
      pending_submissions: num(r.pending_submissions),
    }));
}

// ---------------------------------------------------------------- the functions

const HANDLERS: Record<string, Handler> = {
  async create_organization_with_owner(ctx, a) {
    if (!ctx.userId) throw denied("Not authenticated");
    const name = String(a["p_name"] ?? "").trim();
    if (!name) throw checkViolation("Organization name is required");

    const id = newId();
    await ctx.db.run("INSERT INTO organizations (id, name, business_type) VALUES (?,?,?)", [
      id,
      name,
      a["p_business_type"] ?? "other",
    ]);
    await ctx.db.run("INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?,?,?,'owner')", [
      newId(),
      id,
      ctx.userId,
    ]);
    await ctx.db.run("INSERT INTO stores (id, organization_id, name) VALUES (?,?,?)", [newId(), id, name]);
    await ctx.db.run("INSERT INTO organization_subscriptions (organization_id, plan_code) VALUES (?, 'free')", [id]);
    forgetMemberships(ctx.scope);
    return loadRow(ctx.db, "organizations", id);
  },

  async apply_inventory_movement(ctx, a) {
    return applyMovement(
      ctx,
      a["p_variant_id"],
      a["p_movement_type"],
      Number(a["p_quantity_change"]),
      a["p_order_id"] ?? null,
      a["p_note"] ?? null,
    );
  },

  async transition_order_status(ctx, a) {
    return transition(ctx, a["p_order_id"], a["p_new_status"], a["p_note"] ?? null);
  },

  async set_courier_credentials(ctx, a) {
    const row = await ctx.db.one<{ organization_id: string }>("SELECT organization_id FROM courier_accounts WHERE id = ? FOR UPDATE", [
      a["p_account_id"],
    ]);
    if (!row) throw notFound("Courier account not found");
    await requireMember(ctx, row.organization_id);
    await ctx.db.run("UPDATE courier_accounts SET credentials_enc = ? WHERE id = ?", [encryptJson(a["p_credentials"] ?? {}), a["p_account_id"]]);
    return null;
  },

  async get_courier_credentials(ctx, a) {
    const row = await ctx.db.one<{ credentials_enc: string | null; organization_id: string }>(
      "SELECT credentials_enc, organization_id FROM courier_accounts WHERE id = ?",
      [a["p_account_id"]],
    );
    if (!row) return null;
    await requireMember(ctx, row.organization_id);
    return decryptJson(row.credentials_enc);
  },

  async set_channel_credentials(ctx, a) {
    const row = await ctx.db.one<{ organization_id: string }>("SELECT organization_id FROM channel_connections WHERE id = ? FOR UPDATE", [
      a["p_connection_id"],
    ]);
    if (!row) throw notFound("Channel connection not found");
    await requireMember(ctx, row.organization_id);
    await ctx.db.run("UPDATE channel_connections SET credentials_enc = ? WHERE id = ?", [encryptJson(a["p_credentials"] ?? {}), a["p_connection_id"]]);
    return null;
  },

  async get_channel_credentials(ctx, a) {
    const row = await ctx.db.one<{ credentials_enc: string | null; organization_id: string }>(
      "SELECT credentials_enc, organization_id FROM channel_connections WHERE id = ?",
      [a["p_connection_id"]],
    );
    if (!row) return null;
    await requireMember(ctx, row.organization_id);
    return decryptJson(row.credentials_enc);
  },

  async subscription_overview(ctx, a) {
    const org = a["p_organization_id"];
    if (!(await isMember(ctx, org)) && !(await isPlatformAdmin(ctx))) throw denied("Not allowed");

    const row = await ctx.db.one<any>("SELECT * FROM organization_subscriptions WHERE organization_id = ?", [org]);
    if (!row) return null;
    const plan = await ctx.db.one<any>("SELECT * FROM subscription_plans WHERE code = ?", [row.plan_code]);

    return {
      plan_code: row.plan_code,
      plan_name: plan?.name ?? null,
      monthly_price: num(plan?.monthly_price),
      order_limit: plan?.order_limit ?? null,
      user_limit: plan?.user_limit ?? null,
      status: row.status,
      state: await subscriptionState(ctx.db, org),
      period_start: row.current_period_start,
      period_end: row.current_period_end,
      grace_days: GRACE_DAYS,
      orders_this_month: await ordersThisMonth(ctx.db, org),
    };
  },

  async admin_set_subscription(ctx, a) {
    await requireAdmin(ctx);
    const org = a["p_organization_id"];

    let before = await ctx.db.one<any>("SELECT * FROM organization_subscriptions WHERE organization_id = ? FOR UPDATE", [org]);
    if (!before) {
      await ctx.db.run("INSERT INTO organization_subscriptions (organization_id, plan_code) VALUES (?,?)", [org, a["p_plan_code"] ?? "free"]);
      before = await ctx.db.one<any>("SELECT * FROM organization_subscriptions WHERE organization_id = ? FOR UPDATE", [org]);
    }

    const newPlan = a["p_plan_code"] ?? before.plan_code;
    const price = await ctx.db.one<{ monthly_price: number }>("SELECT monthly_price FROM subscription_plans WHERE code = ?", [newPlan]);
    // Dropping to a free plan wipes the dates, so nothing stale is left behind.
    const clear = Boolean(a["p_clear_period"]) || num(price?.monthly_price) === 0;
    const periodEnd = a["p_period_end"] ?? null;
    const today = todayUtc();

    const newEnd = clear ? null : (periodEnd ?? before.current_period_end);
    const newStart = clear ? null : periodEnd !== null && !before.current_period_start ? today : before.current_period_start;
    const newStatus = a["p_status"] ?? before.status;
    const newNote = a["p_note"] ?? before.note;

    await ctx.db.run(
      `UPDATE organization_subscriptions
          SET plan_code = ?, status = ?, current_period_end = ?, current_period_start = ?, note = ?
        WHERE organization_id = ?`,
      [newPlan, newStatus, newEnd, newStart, newNote, org],
    );

    await ctx.db.run(
      "INSERT INTO subscription_events (id, organization_id, event_type, detail, note, actor) VALUES (?,?,?,?,?,?)",
      [
        newId(),
        org,
        "subscription_changed",
        json({
          from_plan: before.plan_code,
          to_plan: newPlan,
          from_status: before.status,
          to_status: newStatus,
          from_period_end: before.current_period_end,
          to_period_end: newEnd,
        }),
        a["p_note"] ?? null,
        ctx.userId,
      ],
    );
    return loadRow(ctx.db, "organization_subscriptions", org);
  },

  async admin_record_payment(ctx, a) {
    await requireAdmin(ctx);
    return recordPayment(ctx, {
      org: a["p_organization_id"],
      plan: a["p_plan_code"],
      months: Number(a["p_months"]),
      amount: num(a["p_amount"]),
      method: a["p_method"],
      txn: a["p_transaction_id"] ?? null,
      submissionId: a["p_submission_id"] ?? null,
      note: a["p_note"] ?? null,
    });
  },

  async submit_payment(ctx, a) {
    const org = await firstOrganizationId(ctx);
    if (!org) throw denied("Not a member of any organization");

    const txn = String(a["p_transaction_id"] ?? "").trim();
    if (!txn) throw checkViolation("transaction_id must not be empty");

    // The same transaction id can't be claimed twice, unless the earlier claim was rejected.
    const dup = await ctx.db.one(
      "SELECT 1 AS x FROM payment_submissions WHERE LOWER(TRIM(transaction_id)) = ? AND status <> 'rejected' LIMIT 1",
      [txn.toLowerCase()],
    );
    if (dup) throw new DbError('duplicate key value violates unique constraint "payment_submissions_transaction_key"', "23505");

    const id = newId();
    await ctx.db.run(
      `INSERT INTO payment_submissions
         (id, organization_id, plan_code, months, amount, method, sender_number, transaction_id, submitted_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, org, a["p_plan_code"], a["p_months"] ?? 1, num(a["p_amount"]), a["p_method"], blank(a["p_sender_number"]), txn, ctx.userId],
    );
    await ctx.db.run(
      "INSERT INTO subscription_events (id, organization_id, event_type, detail, actor) VALUES (?,?,?,?,?)",
      [
        newId(),
        org,
        "payment_submitted",
        json({ plan: a["p_plan_code"], months: a["p_months"], amount: a["p_amount"], method: a["p_method"], transaction_id: a["p_transaction_id"] }),
        ctx.userId,
      ],
    );
    return loadRow(ctx.db, "payment_submissions", id);
  },

  async admin_review_submission(ctx, a) {
    await requireAdmin(ctx);
    const id = a["p_submission_id"];
    const sub = await ctx.db.one<any>("SELECT * FROM payment_submissions WHERE id = ? FOR UPDATE", [id]);
    if (!sub) throw notFound("Submission not found");
    if (sub.status !== "pending") throw checkViolation("This submission was already reviewed");

    const approve = Boolean(a["p_approve"]);
    const note = a["p_note"] ?? null;

    if (approve) {
      await recordPayment(ctx, {
        org: sub.organization_id,
        plan: sub.plan_code,
        months: num(sub.months),
        amount: num(sub.amount),
        method: sub.method,
        txn: sub.transaction_id,
        submissionId: sub.id,
        note,
      });
    }

    await ctx.db.run(
      "UPDATE payment_submissions SET status = ?, reviewed_by = ?, reviewed_at = UTC_TIMESTAMP(3), review_note = ? WHERE id = ?",
      [approve ? "approved" : "rejected", ctx.userId, note, id],
    );
    await ctx.db.run(
      "INSERT INTO subscription_events (id, organization_id, event_type, detail, note, actor) VALUES (?,?,?,?,?,?)",
      [
        newId(),
        sub.organization_id,
        approve ? "payment_approved" : "payment_rejected",
        json({ submission_id: id, transaction_id: sub.transaction_id }),
        note,
        ctx.userId,
      ],
    );
    return loadRow(ctx.db, "payment_submissions", id);
  },

  async admin_list_organizations(ctx, a) {
    await requireAdmin(ctx);
    return listOrganizations(ctx, a["p_search"] ?? null);
  },

  async admin_organization_detail(ctx, a) {
    await requireAdmin(ctx);
    const org = a["p_organization_id"];
    const row = (await listOrganizations(ctx, null)).find((r) => r.organization_id === org);
    if (!row) return null;

    const count = async (table: string) =>
      num((await ctx.db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE organization_id = ?`, [org]))?.n);
    const last = await ctx.db.one<{ d: string | null }>("SELECT MAX(created_at) AS d FROM orders WHERE organization_id = ?", [org]);
    const members = await ctx.db.all<{ email: string; role: string }>(
      `SELECT u.email, m.role FROM organization_members m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = ? ORDER BY m.created_at`,
      [org],
    );

    // Counts only: never the contents of a seller's orders or customer list.
    return {
      ...row,
      product_count: await count("products"),
      customer_count: await count("customers"),
      courier_count: await count("courier_accounts"),
      last_order_at: iso(last?.d),
      members,
    };
  },

  async admin_list_submissions(ctx, a) {
    await requireAdmin(ctx);
    const status = a["p_status"] ?? null;
    const rows = await ctx.db.all<any>(
      `SELECT ps.id, ps.organization_id, o.name AS organization_name,
              (SELECT u.email FROM organization_members m JOIN users u ON u.id = m.user_id
                WHERE m.organization_id = ps.organization_id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_email,
              ps.plan_code, ps.months, ps.amount, ps.method, ps.sender_number, ps.transaction_id,
              ps.status, ps.created_at, ps.reviewed_at, ps.review_note
         FROM payment_submissions ps JOIN organizations o ON o.id = ps.organization_id
        WHERE (? IS NULL OR ps.status = ?)
        ORDER BY ps.created_at DESC LIMIT 200`,
      [status, status],
    );
    return rows.map((r) => ({ ...r, months: num(r.months), amount: num(r.amount), created_at: iso(r.created_at), reviewed_at: iso(r.reviewed_at) }));
  },

  async subscription_order_gate(ctx, a) {
    const org = a["p_organization_id"];
    if (!(await isMember(ctx, org)) && !(await isPlatformAdmin(ctx))) throw denied("Not allowed");

    const state = await subscriptionState(ctx.db, org);
    const plan = await ctx.db.one<{ order_limit: number | null }>(
      `SELECT p.order_limit FROM organization_subscriptions s JOIN subscription_plans p ON p.code = s.plan_code
        WHERE s.organization_id = ?`,
      [org],
    );
    const limit = plan?.order_limit ?? null;
    const used = await ordersThisMonth(ctx.db, org);

    let reason: string | null = null;
    if (state === "suspended") reason = "SUBSCRIPTION_SUSPENDED";
    else if (state === "expired") reason = "SUBSCRIPTION_EXPIRED";
    else if (limit !== null && used >= limit) reason = "ORDER_LIMIT_REACHED";

    return { state, order_limit: limit, orders_this_month: used, allowed: reason === null, reason };
  },

  async record_inbound_message(ctx, a) {
    const conn = await ctx.db.one<any>("SELECT * FROM channel_connections WHERE id = ?", [a["p_connection_id"]]);
    if (!conn) throw notFound("Channel connection not found");
    await requireMember(ctx, conn.organization_id);

    const thread = blank(a["p_thread_id"]);
    if (!thread) throw new DbError("A thread id is required", "22023");

    const body = blank(a["p_body"]);
    const attachments = Array.isArray(a["p_attachments"]) ? a["p_attachments"] : [];
    if (!body && attachments.length === 0) throw new DbError("A message needs text or an attachment", "22023");

    const sentAt = a["p_sent_at"] ? toDbDateTime(a["p_sent_at"]) : toDbDateTime(new Date());

    await ctx.db.run(
      `INSERT INTO conversations (id, organization_id, channel_connection_id, external_id, contact_name, contact_handle)
       VALUES (?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE contact_name = COALESCE(VALUES(contact_name), contact_name),
                               contact_handle = COALESCE(VALUES(contact_handle), contact_handle)`,
      [newId(), conn.organization_id, conn.id, thread, blank(a["p_contact_name"]), blank(a["p_contact_handle"])],
    );
    const conversation = await ctx.db.one<{ id: string }>(
      "SELECT id FROM conversations WHERE channel_connection_id = ? AND external_id = ?",
      [conn.id, thread],
    );
    const conversationId = conversation!.id;

    const messageId = newId();
    try {
      await ctx.db.run(
        `INSERT INTO messages
           (id, organization_id, conversation_id, direction, author, body, attachments, external_id, delivery, sent_at, payload)
         VALUES (?,?,?,'inbound','customer',?,?,?, 'received', ?, ?)`,
        [messageId, conn.organization_id, conversationId, body, JSON.stringify(attachments), blank(a["p_external_id"]), sentAt, json(a["p_payload"])],
      );
    } catch (error) {
      // The provider sent this one before; the conversation must not move again.
      if (toDbError(error).code === "23505") {
        return { conversation_id: conversationId, message_id: null, duplicate: true };
      }
      throw error;
    }

    const preview = [...(body ?? "Attachment")].slice(0, 160).join("");
    await ctx.db.run(
      `UPDATE conversations
          SET last_message_at = ?, last_inbound_at = ?, last_message_preview = ?,
              unread_count = unread_count + 1,
              status = CASE WHEN status IN ('closed','snoozed') THEN 'open' ELSE status END,
              snoozed_until = NULL
        WHERE id = ?`,
      [sentAt, sentAt, preview, conversationId],
    );
    await ctx.db.run("UPDATE channel_connections SET last_event_at = ? WHERE id = ?", [sentAt, conn.id]);

    return { conversation_id: conversationId, message_id: messageId, duplicate: false };
  },

  async record_outbound_message(ctx, a) {
    const conv = await ctx.db.one<any>("SELECT * FROM conversations WHERE id = ?", [a["p_conversation_id"]]);
    if (!conv) throw notFound("Conversation not found");
    await requireMember(ctx, conv.organization_id);

    const author = a["p_author"] ?? "agent";
    if (author === "customer") throw new DbError("An outbound message cannot come from the customer", "22023");

    const body = blank(a["p_body"]);
    const attachments = Array.isArray(a["p_attachments"]) ? a["p_attachments"] : [];
    const id = newId();
    await ctx.db.run(
      `INSERT INTO messages
         (id, organization_id, conversation_id, direction, author, author_user_id, body, attachments, delivery)
       VALUES (?,?,?,'outbound',?,?,?,?, 'queued')`,
      [id, conv.organization_id, conv.id, author, ctx.userId, body, JSON.stringify(attachments)],
    );
    const preview = [...(body ?? "Attachment")].slice(0, 160).join("");
    await ctx.db.run(
      "UPDATE conversations SET last_message_at = UTC_TIMESTAMP(3), last_message_preview = ?, unread_count = 0 WHERE id = ?",
      [preview, conv.id],
    );
    return id;
  },

  async update_message_delivery(ctx, a) {
    const msg = await ctx.db.one<any>("SELECT * FROM messages WHERE id = ?", [a["p_message_id"]]);
    if (!msg) throw notFound("Message not found");
    await requireMember(ctx, msg.organization_id);

    const delivery = a["p_delivery"];
    await ctx.db.run(
      `UPDATE messages
          SET delivery = ?, external_id = COALESCE(?, external_id), error = ?,
              sent_at = CASE WHEN ? IN ('sent','delivered','read') THEN COALESCE(sent_at, UTC_TIMESTAMP(3)) ELSE sent_at END
        WHERE id = ?`,
      [delivery, blank(a["p_external_id"]), a["p_error"] ?? null, delivery, a["p_message_id"]],
    );
    return null;
  },

  async mark_conversation_read(ctx, a) {
    const conv = await ctx.db.one<{ organization_id: string }>("SELECT organization_id FROM conversations WHERE id = ?", [a["p_conversation_id"]]);
    if (!conv) return null;
    await requireMember(ctx, conv.organization_id);
    await ctx.db.run("UPDATE conversations SET unread_count = 0 WHERE id = ? AND unread_count > 0", [a["p_conversation_id"]]);
    return null;
  },

  async customer_risk(ctx, a) {
    return customerRisk(ctx, a["p_customer_id"] ?? null);
  },

  async order_confirmation_decision(ctx, a) {
    return confirmationDecision(ctx, a["p_order_id"]);
  },

  async auto_confirm_order(ctx, a) {
    const order = await ctx.db.one<any>("SELECT * FROM orders WHERE id = ?", [a["p_order_id"]]);
    if (!order) return false;
    await requireMember(ctx, order.organization_id);
    if (order.status !== "new") return false;

    const decision = await confirmationDecision(ctx, a["p_order_id"]);
    if (decision.action !== "auto") return false;

    await ctx.db.run("SAVEPOINT auto_confirm");
    try {
      await transition(ctx, a["p_order_id"], "confirmed", "Confirmed automatically by the confirmation rules");
      await ctx.db.run("RELEASE SAVEPOINT auto_confirm");
    } catch {
      // Not enough stock, or some other guard said no. Leave it for a person.
      await ctx.db.run("ROLLBACK TO SAVEPOINT auto_confirm");
      return false;
    }
    return true;
  },

  async cod_summary(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);

    const out = await ctx.db.one<any>(
      "SELECT COUNT(*) AS n, COALESCE(SUM(cod_amount), 0) AS amount FROM cod_unsettled_shipments WHERE organization_id = ?",
      [org],
    );
    const expected = await ctx.db.one<any>("SELECT COALESCE(SUM(net_amount), 0) AS v FROM courier_payout_items WHERE organization_id = ?", [org]);
    const received = await ctx.db.one<any>("SELECT COALESCE(SUM(amount_received), 0) AS v FROM courier_payouts WHERE organization_id = ?", [org]);

    return {
      outstanding_count: num(out?.n),
      outstanding_amount: num(out?.amount),
      expected_total: num(expected?.v),
      received_total: num(received?.v),
      difference: Math.round((num(received?.v) - num(expected?.v)) * 100) / 100,
    };
  },

  async record_courier_payout(ctx, a) {
    let org: string | null = null;
    if (a["p_courier_account_id"]) {
      org = (await ctx.db.one<{ organization_id: string }>("SELECT organization_id FROM courier_accounts WHERE id = ?", [a["p_courier_account_id"]]))?.organization_id ?? null;
    }
    if (!org) org = await firstOrganizationId(ctx);
    if (!org || !(await isMember(ctx, org))) throw denied("Not a member of this organization");
    if (!ctx.service && (await roleIn(ctx, org)) !== "owner") throw denied("ROLE_DENIED: only the owner can record a payout");

    const items: any[] = Array.isArray(a["p_items"]) ? a["p_items"] : [];
    if (items.length === 0) throw new DbError("A payout must cover at least one parcel", "22023");

    const payoutId = newId();
    await ctx.db.run(
      `INSERT INTO courier_payouts
         (id, organization_id, courier_account_id, provider, reference, paid_on, amount_received, method, note, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        payoutId,
        org,
        a["p_courier_account_id"] ?? null,
        a["p_provider"],
        blank(a["p_reference"]),
        a["p_paid_on"] ?? todayUtc(),
        num(a["p_amount_received"]),
        a["p_method"] ?? "bank",
        blank(a["p_note"]),
        ctx.userId,
      ],
    );

    for (const item of items) {
      const shipment = await ctx.db.one<any>("SELECT * FROM shipments WHERE id = ?", [item.shipment_id]);
      if (!shipment) throw notFound("Parcel not found");
      if (shipment.organization_id !== org) throw denied("That parcel belongs to another organization");

      const label = shipment.consignment_id ?? shipment.id;
      if (shipment.status !== "delivered") throw checkViolation(`Parcel ${label} has not been delivered yet`);

      const settled = await ctx.db.one("SELECT 1 AS x FROM courier_payout_items WHERE shipment_id = ?", [shipment.id]);
      if (settled) throw new DbError(`Parcel ${label} is already settled in another payout`, "23505");

      const cod = num(shipment.cod_amount);
      const charge = num(item.delivery_charge);
      const fee = num(item.cod_fee);
      const adjustment = num(item.adjustment);
      await ctx.db.run(
        `INSERT INTO courier_payout_items
           (id, organization_id, payout_id, shipment_id, order_id, cod_amount, delivery_charge, cod_fee, adjustment, net_amount)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [newId(), org, payoutId, shipment.id, shipment.order_id, cod, charge, fee, adjustment, Math.round((cod - charge - fee + adjustment) * 100) / 100],
      );
    }
    return payoutId;
  },

  async organization_team(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);
    const rows = await ctx.db.all<any>(
      `SELECT m.id AS member_id, m.user_id, m.role, p.full_name, u.email, m.created_at AS joined_at
         FROM organization_members m
         JOIN users u ON u.id = m.user_id
         LEFT JOIN profiles p ON p.id = m.user_id
        WHERE m.organization_id = ?
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, m.created_at`,
      [org],
    );
    return rows.map((r) => ({ ...r, joined_at: iso(r.joined_at) }));
  },

  async invitation_preview(ctx, a) {
    const invite = await ctx.db.one<any>("SELECT * FROM organization_invitations WHERE token = ?", [a["p_token"]]);
    if (!invite) return { status: "not_found" };

    const org = await ctx.db.one<{ name: string }>("SELECT name FROM organizations WHERE id = ?", [invite.organization_id]);
    const expired = new Date(iso(invite.expires_at) ?? 0).getTime() < Date.now();

    let status = "open";
    if (invite.revoked_at) status = "revoked";
    else if (invite.accepted_at) status = "accepted";
    else if (expired) status = "expired";

    return { status, organization_name: org?.name ?? null, email: invite.email, role: invite.role };
  },

  async accept_invitation(ctx, a) {
    if (!ctx.userId) throw denied("Sign in first");

    const invite = await ctx.db.one<any>("SELECT * FROM organization_invitations WHERE token = ? FOR UPDATE", [a["p_token"]]);
    if (!invite) throw notFound("INVITE_NOT_FOUND");
    if (invite.revoked_at) throw checkViolation("INVITE_REVOKED");
    if (invite.accepted_at) throw checkViolation("INVITE_USED");
    if (new Date(iso(invite.expires_at) ?? 0).getTime() < Date.now()) throw checkViolation("INVITE_EXPIRED");

    const user = await ctx.db.one<{ email: string }>("SELECT email FROM users WHERE id = ?", [ctx.userId]);
    if (String(user?.email ?? "").toLowerCase() !== String(invite.email).toLowerCase()) throw denied("INVITE_WRONG_EMAIL");

    // The dashboard works with one organization per person.
    const already = await ctx.db.one("SELECT 1 AS x FROM organization_members WHERE user_id = ? LIMIT 1", [ctx.userId]);
    if (already) throw new DbError("INVITE_ALREADY_MEMBER", "23505");

    await enforceUserLimit(ctx.db, invite.organization_id);
    await ctx.db.run("INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?,?,?,?)", [
      newId(),
      invite.organization_id,
      ctx.userId,
      invite.role,
    ]);
    await ctx.db.run("UPDATE organization_invitations SET accepted_at = UTC_TIMESTAMP(3), accepted_by = ? WHERE id = ?", [ctx.userId, invite.id]);
    forgetMemberships(ctx.scope);
    return invite.organization_id;
  },

  async record_order_return(ctx, a) {
    const orderId = a["p_order_id"];
    const order = await ctx.db.one<any>("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (!order) throw notFound("Order not found");
    await requireMember(ctx, order.organization_id);

    const existing = await ctx.db.one("SELECT 1 AS x FROM order_returns WHERE order_id = ?", [orderId]);
    if (existing) throw new DbError("RETURN_ALREADY_RECORDED", "23505");

    // The state machine decides whether this order may come back at all.
    if (order.status !== "returned") await transition(ctx, orderId, "returned", a["p_note"] ?? null);

    const restock = a["p_restock"] === null || a["p_restock"] === undefined ? true : Boolean(a["p_restock"]);
    if (!restock) {
      const items = await ctx.db.all<{ variant_id: string; quantity: number }>(
        "SELECT variant_id, quantity FROM order_items WHERE order_id = ? AND variant_id IS NOT NULL",
        [orderId],
      );
      for (const item of items) {
        await applyMovement(ctx, item.variant_id, "damage", -item.quantity, orderId, "Returned unsellable");
      }
    }

    const shipment = await ctx.db.one<{ id: string }>("SELECT id FROM shipments WHERE order_id = ? LIMIT 1", [orderId]);
    const id = newId();
    await ctx.db.run(
      `INSERT INTO order_returns (id, organization_id, order_id, shipment_id, reason, return_charge, restocked, note, recorded_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, order.organization_id, orderId, shipment?.id ?? null, a["p_reason"] ?? "other", num(a["p_return_charge"]), restock ? 1 : 0, blank(a["p_note"]), ctx.userId],
    );
    return id;
  },

  async returns_summary(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);

    const r = await ctx.db.one<any>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(r.return_charge), 0) AS charges, COALESCE(SUM(o.total), 0) AS value,
              COALESCE(SUM(r.restocked = 0), 0) AS unsellable
         FROM order_returns r JOIN orders o ON o.id = r.order_id
        WHERE r.organization_id = ? AND r.created_at >= ${monthStart}`,
      [org],
    );
    const d = await ctx.db.one<any>(
      `SELECT COUNT(*) AS n FROM orders
        WHERE organization_id = ? AND status = 'delivered' AND delivered_at >= ${monthStart}`,
      [org],
    );
    return {
      count: num(r?.n),
      charges: num(r?.charges),
      order_value: num(r?.value),
      unsellable: num(r?.unsellable),
      delivered: num(d?.n),
    };
  },

  async profit_summary(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);
    const from = a["p_from"];
    const to = a["p_to"];

    const rev = await ctx.db.one<any>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total), 0) AS v FROM orders
        WHERE organization_id = ? AND status = 'delivered' AND DATE(delivered_at) BETWEEN ? AND ?`,
      [org, from, to],
    );
    const cogs = await ctx.db.one<any>(
      `SELECT COALESCE(SUM(i.unit_cost * i.quantity), 0) AS v FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.organization_id = ? AND o.status = 'delivered' AND DATE(o.delivered_at) BETWEEN ? AND ?`,
      [org, from, to],
    );
    const courier = await ctx.db.one<any>(
      `SELECT COALESCE(SUM(pi.delivery_charge + pi.cod_fee - pi.adjustment), 0) AS v
         FROM courier_payout_items pi JOIN orders o ON o.id = pi.order_id
        WHERE pi.organization_id = ? AND o.status = 'delivered' AND DATE(o.delivered_at) BETWEEN ? AND ?`,
      [org, from, to],
    );
    const ret = await ctx.db.one<any>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(return_charge), 0) AS v FROM order_returns
        WHERE organization_id = ? AND DATE(created_at) BETWEEN ? AND ?`,
      [org, from, to],
    );
    const diff = await ctx.db.one<any>(
      `SELECT COALESCE(SUM(p.amount_received - COALESCE(l.expected, 0)), 0) AS v
         FROM courier_payouts p
         LEFT JOIN (SELECT payout_id, SUM(net_amount) AS expected FROM courier_payout_items GROUP BY payout_id) l ON l.payout_id = p.id
        WHERE p.organization_id = ? AND p.paid_on BETWEEN ? AND ?`,
      [org, from, to],
    );

    const revenue = num(rev?.v);
    const cost = num(cogs?.v);
    const courierCharges = num(courier?.v);
    const returns = num(ret?.v);
    const codDifference = num(diff?.v);
    const net = revenue - cost - courierCharges - returns + codDifference;
    const r2 = (v: number) => Math.round(v * 100) / 100;

    return {
      revenue,
      cogs: cost,
      gross_profit: r2(revenue - cost),
      courier_charges: courierCharges,
      return_charges: returns,
      cod_difference: r2(codDifference),
      net_profit: r2(net),
      delivered_orders: num(rev?.n),
      returned_orders: num(ret?.n),
      margin: revenue > 0 ? Math.round((net / revenue) * 1000) / 10 : 0,
    };
  },

  async product_profit(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);
    const rows = await ctx.db.all<any>(
      `SELECT i.product_name, i.variant_name, SUM(i.quantity) AS quantity, SUM(i.line_total) AS revenue,
              SUM(i.unit_cost * i.quantity) AS cost,
              SUM(i.line_total) - SUM(i.unit_cost * i.quantity) AS profit
         FROM order_items i JOIN orders o ON o.id = i.order_id
        WHERE o.organization_id = ? AND o.status = 'delivered' AND DATE(o.delivered_at) BETWEEN ? AND ?
        GROUP BY i.product_name, i.variant_name
        ORDER BY profit DESC LIMIT 10`,
      [org, a["p_from"], a["p_to"]],
    );
    return rows.map((r) => ({ ...r, quantity: num(r.quantity), revenue: num(r.revenue), cost: num(r.cost), profit: num(r.profit) }));
  },

  async morning_brief(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);
    const one = async (sql: string, params: any[] = [org]) => (await ctx.db.one<any>(sql, params)) ?? {};

    const toConfirm = await one("SELECT COUNT(*) AS n FROM orders WHERE organization_id = ? AND status = 'new'");
    // Out with a courier and silent for three days.
    const stuck = await one(
      `SELECT COUNT(*) AS n FROM shipments
        WHERE organization_id = ? AND status NOT IN ('delivered','returned','cancelled')
          AND COALESCE(last_event_at, created_at) < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY)`,
    );
    const low = await one(
      `SELECT COUNT(*) AS n FROM product_variants v JOIN products p ON p.id = v.product_id
        WHERE v.organization_id = ? AND v.is_active = 1 AND p.is_active = 1 AND v.stock < p.low_stock_threshold`,
    );
    const cod = await one("SELECT COUNT(*) AS n, COALESCE(SUM(cod_amount), 0) AS amount FROM cod_unsettled_shipments WHERE organization_id = ?");
    // Came back, but nobody wrote down what it cost.
    const returns = await one(
      `SELECT COUNT(*) AS n FROM orders o
        WHERE o.organization_id = ? AND o.status = 'returned'
          AND NOT EXISTS (SELECT 1 FROM order_returns r WHERE r.order_id = o.id)`,
    );
    const unread = await one("SELECT COALESCE(SUM(unread_count), 0) AS n FROM conversations WHERE organization_id = ?");

    return {
      to_confirm: num(toConfirm.n),
      stuck_parcels: num(stuck.n),
      low_stock: num(low.n),
      cod_outstanding: num(cod.amount),
      cod_parcels: num(cod.n),
      returns_to_record: num(returns.n),
      unread_messages: num(unread.n),
    };
  },

  async courier_performance(ctx, a) {
    const org = a["p_organization_id"];
    await requireMember(ctx, org);
    const rows = await ctx.db.all<any>(
      `SELECT a.id AS courier_account_id, COALESCE(a.label, s.provider) AS label, s.provider AS provider,
              COUNT(*) AS sent,
              COALESCE(SUM(s.status = 'delivered'), 0) AS delivered,
              COALESCE(SUM(s.status = 'returned'), 0) AS returned,
              COALESCE(SUM(s.status NOT IN ('delivered','returned','cancelled')), 0) AS in_flight,
              COALESCE(SUM(s.status IN ('delivered','returned')), 0) AS concluded,
              AVG(CASE WHEN s.status = 'delivered'
                       THEN TIMESTAMPDIFF(SECOND, s.created_at, COALESCE(s.last_event_at, s.updated_at)) / 86400 END) AS avg_days,
              COALESCE(SUM(CASE WHEN s.status = 'delivered' THEN s.cod_amount END), 0) AS cod_collected,
              COALESCE((
                SELECT SUM(pi.delivery_charge + pi.cod_fee - pi.adjustment)
                  FROM courier_payout_items pi JOIN shipments ps ON ps.id = pi.shipment_id
                 WHERE ps.courier_account_id <=> a.id AND pi.organization_id = ?
                   AND DATE(ps.created_at) BETWEEN ? AND ?
              ), 0) AS charges
         FROM shipments s LEFT JOIN courier_accounts a ON a.id = s.courier_account_id
        WHERE s.organization_id = ? AND DATE(s.created_at) BETWEEN ? AND ?
        GROUP BY a.id, a.label, s.provider
        ORDER BY sent DESC`,
      [org, a["p_from"], a["p_to"], org, a["p_from"], a["p_to"]],
    );
    return rows.map((r) => ({
      courier_account_id: r.courier_account_id,
      label: r.label,
      provider: r.provider,
      sent: num(r.sent),
      delivered: num(r.delivered),
      returned: num(r.returned),
      in_flight: num(r.in_flight),
      // Out of the parcels that reached a conclusion, not out of everything sent.
      return_rate: num(r.concluded) > 0 ? Math.round((num(r.returned) / num(r.concluded)) * 100) : 0,
      avg_days: r.avg_days === null ? null : Math.round(num(r.avg_days) * 10) / 10,
      cod_collected: num(r.cod_collected),
      charges: num(r.charges),
    }));
  },

  async record_audit(ctx, a) {
    if (!ctx.userId) return null;
    const org = await firstOrganizationId(ctx);
    if (!org) return null;
    await ctx.db.run("INSERT INTO audit_events (id, organization_id, actor, action, entity, entity_id, detail) VALUES (?,?,?,?,?,?,?)", [
      newId(),
      org,
      ctx.userId,
      a["p_action"],
      a["p_entity"] ?? null,
      a["p_entity_id"] ?? null,
      json(a["p_detail"]),
    ]);
    return null;
  },

  async audit_trail(ctx, a) {
    const org = a["p_organization_id"];
    if (!ctx.service && (await roleIn(ctx, org)) !== "owner") throw denied("Only the owner can read the activity log");

    const limit = Math.min(Number(a["p_limit"] ?? 100) || 100, 500);
    const rows = await ctx.db.all<any>(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.detail, p.full_name AS actor_name, u.email AS actor_email, a.created_at
         FROM audit_events a
         LEFT JOIN users u ON u.id = a.actor
         LEFT JOIN profiles p ON p.id = a.actor
        WHERE a.organization_id = ?
        ORDER BY a.created_at DESC LIMIT ${limit}`,
      [org],
    );
    return rows.map((r) => {
      let detail = r.detail;
      if (typeof detail === "string") {
        try {
          detail = JSON.parse(detail);
        } catch {
          // keep the text
        }
      }
      return { ...r, detail, created_at: iso(r.created_at) };
    });
  },
};

export const RPC_NAMES = Object.keys(HANDLERS);

export async function callRpc(
  scope: Scope,
  name: string,
  args: Args = {},
): Promise<{ data: any; error: ReturnType<DbError["toJSON"]> | null; count: null }> {
  const handler = HANDLERS[name];
  if (!handler) {
    return { data: null, error: new DbError(`Could not find the function ${name}`, "PGRST202").toJSON(), count: null };
  }
  try {
    const data = await withTx((db) => handler({ db, scope, userId: scope.userId, service: scope.unrestricted }, args));
    return { data: data === undefined ? null : data, error: null, count: null };
  } catch (error) {
    return { data: null, error: toDbError(error).toJSON(), count: null };
  }
}
