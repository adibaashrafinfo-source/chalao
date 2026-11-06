/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { DbError, denied, toDbError, type DbErrorShape } from "@/lib/db/errors";
import { fromDbRow, toDbValue } from "@/lib/db/convert";
import { getMeta, type TableInfo } from "@/lib/db/meta";
import { canInsertRow, HIDDEN_COLUMNS, rowCondition, type Op, type Scope } from "@/lib/db/policies";
import { poolDb, newId, type Db } from "@/lib/db/db";
import { runBeforeWrite } from "@/lib/db/hooks";

/**
 * A small query builder with the same call shape the app used with the old hosted client
 * (`from("orders").select(...).eq(...).order(...)`), running plain SQL against MySQL.
 * Every call resolves to `{ data, error, count }` and never throws.
 */

// ---------------------------------------------------------------- select list parsing

type Embed = { key: string; table: string; hint: string | null; cols: SelectSpec };
type SelectSpec = { all: boolean; cols: { name: string; alias: string }[]; embeds: Embed[] };

function splitTop(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

function parseSelect(text: string): SelectSpec {
  const spec: SelectSpec = { all: false, cols: [], embeds: [] };
  for (const part of splitTop(text)) {
    if (part === "*") {
      spec.all = true;
      continue;
    }
    const open = part.indexOf("(");
    if (open === -1) {
      const [alias, name] = part.includes(":") ? (part.split(":") as [string, string]) : [part, part];
      spec.cols.push({ name: name.trim(), alias: alias.trim() });
      continue;
    }
    let head = part.slice(0, open).trim();
    const inner = part.slice(open + 1, part.lastIndexOf(")"));
    let key: string | null = null;
    if (head.includes(":")) {
      const [a, rest] = head.split(":") as [string, string];
      key = a.trim();
      head = rest.trim();
    }
    let hint: string | null = null;
    if (head.includes("!")) {
      const [t, h] = head.split("!") as [string, string];
      head = t;
      hint = h === "inner" || h === "left" ? null : h;
    }
    spec.embeds.push({ key: key ?? head, table: head, hint, cols: parseSelect(inner) });
  }
  return spec;
}

// ---------------------------------------------------------------- filters

type Filter = (ctx: BuildCtx) => { sql: string; params: any[] };
type BuildCtx = { info: TableInfo; table: string };

const q = (name: string) => `\`${name.replace(/`/g, "")}\``;

function colKind(ctx: BuildCtx, column: string) {
  if (!ctx.info.columns.has(column)) throw new DbError(`column "${column}" does not exist on ${ctx.table}`, "42703");
  return ctx.info.columns.get(column);
}

const OPS: Record<string, string> = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE", ilike: "LIKE" };

function comparison(column: string, op: string, value: any): Filter {
  return (ctx) => {
    const kind = colKind(ctx, column);
    const col = `${q(ctx.table)}.${q(column)}`;

    if (op === "is") {
      if (value === null || value === "null") return { sql: `${col} IS NULL`, params: [] };
      return { sql: `${col} = ?`, params: [value === true || value === "true" ? 1 : 0] };
    }
    if (op === "in") {
      const list: any[] = Array.isArray(value)
        ? value
        : String(value)
            .replace(/^\(|\)$/g, "")
            .split(",")
            .map((s) => s.trim().replace(/^"|"$/g, ""))
            .filter((s) => s !== "");
      if (list.length === 0) return { sql: "1 = 0", params: [] };
      return { sql: `${col} IN (${list.map(() => "?").join(",")})`, params: list.map((v) => toDbValue(kind, v)) };
    }
    if (op === "eq" && (value === null || value === "null")) return { sql: `${col} IS NULL`, params: [] };
    if (op === "neq" && (value === null || value === "null")) return { sql: `${col} IS NOT NULL`, params: [] };

    const sqlOp = OPS[op];
    if (!sqlOp) throw new DbError(`unsupported filter operator "${op}"`, "42883");
    const bound = op === "like" || op === "ilike" ? String(value).replace(/\*/g, "%") : toDbValue(kind, value);
    return { sql: `${col} ${sqlOp} ?`, params: [bound] };
  };
}

function negate(inner: Filter): Filter {
  return (ctx) => {
    const r = inner(ctx);
    return { sql: `NOT (${r.sql})`, params: r.params };
  };
}

/** `a.eq.1,b.ilike.%x%` (and nested `and(...)`/`or(...)` groups). */
function parseOr(expression: string): Filter {
  const parts = splitTop(expression);
  const filters = parts.map((part): Filter => {
    const group = /^(and|or)\(([\s\S]*)\)$/.exec(part);
    if (group) {
      const inner = splitTop(group[2]!).map((p) => parseCondition(p));
      return combine(inner, group[1] === "and" ? "AND" : "OR");
    }
    return parseCondition(part);
  });
  return combine(filters, "OR");
}

function parseCondition(part: string): Filter {
  const first = part.indexOf(".");
  const second = part.indexOf(".", first + 1);
  if (first < 1 || second < 0) throw new DbError(`bad filter "${part}"`, "42601");
  const column = part.slice(0, first);
  let op = part.slice(first + 1, second);
  let value: any = part.slice(second + 1);
  let not = false;
  if (op === "not") {
    not = true;
    const rest = value as string;
    const dot = rest.indexOf(".");
    op = rest.slice(0, dot);
    value = rest.slice(dot + 1);
  }
  const f = comparison(column, op, value);
  return not ? negate(f) : f;
}

function combine(filters: Filter[], glue: "AND" | "OR"): Filter {
  return (ctx) => {
    const parts = filters.map((f) => f(ctx));
    if (parts.length === 0) return { sql: "1 = 1", params: [] };
    return { sql: `(${parts.map((p) => p.sql).join(` ${glue} `)})`, params: parts.flatMap((p) => p.params) };
  };
}

// ---------------------------------------------------------------- builder

type Row = Record<string, any>;
type Result<T = any> = { data: T; error: DbErrorShape | null; count: number | null };

type State = {
  op: "select" | "insert" | "update" | "delete" | "upsert";
  columns: string;
  count: boolean;
  head: boolean;
  rows: Record<string, any>[];
  values: Record<string, any>;
  filters: Filter[];
  orders: { column: string; ascending: boolean; nullsFirst: boolean | undefined }[];
  limit: number | null;
  offset: number;
  mode: "many" | "single" | "maybeSingle";
  returning: boolean;
  onConflict: string[] | null;
  ignoreDuplicates: boolean;
};

export class QueryBuilder<T = Row[] | null> implements PromiseLike<Result<T>> {
  private s: State = {
    op: "select",
    columns: "*",
    count: false,
    head: false,
    rows: [],
    values: {},
    filters: [],
    orders: [],
    limit: null,
    offset: 0,
    mode: "many",
    returning: false,
    onConflict: null,
    ignoreDuplicates: false,
  };

  constructor(
    private readonly table: string,
    private readonly scope: Scope,
    private readonly db: Db,
  ) {}

  select(columns = "*", options?: { count?: string; head?: boolean }): this {
    if (this.s.op === "select") {
      this.s.columns = columns;
      this.s.count = Boolean(options?.count);
      this.s.head = Boolean(options?.head);
    } else {
      this.s.returning = true;
      this.s.columns = columns;
    }
    return this;
  }

  insert(rows: Record<string, any> | Record<string, any>[]): this {
    this.s.op = "insert";
    this.s.rows = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(
    rows: Record<string, any> | Record<string, any>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): this {
    this.s.op = "upsert";
    this.s.rows = Array.isArray(rows) ? rows : [rows];
    this.s.onConflict = options?.onConflict ? options.onConflict.split(",").map((c) => c.trim()) : null;
    this.s.ignoreDuplicates = Boolean(options?.ignoreDuplicates);
    return this;
  }

  update(values: Record<string, any>): this {
    this.s.op = "update";
    this.s.values = values;
    return this;
  }

  delete(): this {
    this.s.op = "delete";
    return this;
  }

  private add(f: Filter): this {
    this.s.filters.push(f);
    return this;
  }

  eq(column: string, value: any) {
    return this.add(comparison(column, "eq", value));
  }
  neq(column: string, value: any) {
    return this.add(comparison(column, "neq", value));
  }
  gt(column: string, value: any) {
    return this.add(comparison(column, "gt", value));
  }
  gte(column: string, value: any) {
    return this.add(comparison(column, "gte", value));
  }
  lt(column: string, value: any) {
    return this.add(comparison(column, "lt", value));
  }
  lte(column: string, value: any) {
    return this.add(comparison(column, "lte", value));
  }
  like(column: string, value: string) {
    return this.add(comparison(column, "like", value));
  }
  ilike(column: string, value: string) {
    return this.add(comparison(column, "ilike", value));
  }
  is(column: string, value: null | boolean) {
    return this.add(comparison(column, "is", value));
  }
  in(column: string, values: any[]) {
    return this.add(comparison(column, "in", values));
  }
  not(column: string, op: string, value: any) {
    return this.add(negate(comparison(column, op, value)));
  }
  filter(column: string, op: string, value: any) {
    return this.add(comparison(column, op, value));
  }
  or(expression: string) {
    return this.add(parseOr(expression));
  }
  match(values: Record<string, any>) {
    for (const [k, v] of Object.entries(values)) this.eq(k, v);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.s.orders.push({ column, ascending: options?.ascending !== false, nullsFirst: options?.nullsFirst });
    return this;
  }
  limit(n: number) {
    this.s.limit = n;
    return this;
  }
  range(from: number, to: number) {
    this.s.offset = from;
    this.s.limit = to - from + 1;
    return this;
  }
  single(): QueryBuilder<Row> {
    this.s.mode = "single";
    return this as unknown as QueryBuilder<Row>;
  }
  maybeSingle(): QueryBuilder<Row | null> {
    this.s.mode = "maybeSingle";
    return this as unknown as QueryBuilder<Row | null>;
  }

  then<A = Result<T>, B = never>(
    onfulfilled?: ((value: Result<T>) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: any) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return this.execute().then(onfulfilled as any, onrejected);
  }

  private async execute(): Promise<Result<T>> {
    try {
      const meta = await getMeta();
      const info = meta.tables.get(this.table);
      if (!info) throw new DbError(`relation "${this.table}" does not exist`, "42P01");

      let result: Result;
      switch (this.s.op) {
        case "select":
          result = await this.runSelect(info);
          break;
        case "insert":
        case "upsert":
          result = await this.runInsert(info);
          break;
        case "update":
          result = await this.runUpdate(info);
          break;
        default:
          result = await this.runDelete(info);
      }
      return result as Result<T>;
    } catch (error) {
      const e = toDbError(error);
      return { data: null as T, error: e.toJSON(), count: null };
    }
  }

  // ------------------------------------------------------------------ pieces

  private async where(info: TableInfo, op: Op, extra?: { sql: string; params: any[] }) {
    const ctx: BuildCtx = { info, table: this.table };
    const parts: string[] = [];
    const params: any[] = [];
    for (const f of this.s.filters) {
      const r = f(ctx);
      parts.push(r.sql);
      params.push(...r.params);
    }
    const policy = await rowCondition(this.scope, this.table, op, this.table);
    if (policy) {
      parts.push(policy.sql);
      params.push(...policy.params);
    }
    if (extra) {
      parts.push(extra.sql);
      params.push(...extra.params);
    }
    return { sql: parts.length ? `WHERE ${parts.join(" AND ")}` : "", params };
  }

  private orderSql(info: TableInfo): string {
    if (this.s.orders.length === 0) return "";
    const items = this.s.orders.map((o) => {
      if (!info.columns.has(o.column)) throw new DbError(`column "${o.column}" does not exist on ${this.table}`, "42703");
      const col = `${q(this.table)}.${q(o.column)}`;
      // Postgres sorts nulls last for ascending and first for descending; keep that.
      const nullsFirst = o.nullsFirst ?? !o.ascending;
      return `${col} IS NULL ${nullsFirst ? "DESC" : "ASC"}, ${col} ${o.ascending ? "ASC" : "DESC"}`;
    });
    return `ORDER BY ${items.join(", ")}`;
  }

  private limitSql(): string {
    if (this.s.limit === null && this.s.offset === 0) return "";
    const limit = this.s.limit === null ? "18446744073709551615" : String(Math.max(0, Math.floor(this.s.limit)));
    return `LIMIT ${limit} OFFSET ${Math.max(0, Math.floor(this.s.offset))}`;
  }

  private shape(rows: any[], count: number | null): Result {
    if (this.s.mode === "many") return { data: rows, error: null, count };
    if (rows.length === 1) return { data: rows[0], error: null, count };
    if (rows.length === 0 && this.s.mode === "maybeSingle") return { data: null, error: null, count };
    const message = "JSON object requested, multiple (or no) rows returned";
    return { data: null, error: new DbError(message, "PGRST116").toJSON(), count };
  }

  private async runSelect(info: TableInfo): Promise<Result> {
    const spec = parseSelect(this.s.columns);
    const { sql: whereSql, params } = await this.where(info, "select");

    let count: number | null = null;
    if (this.s.count) {
      const c = await this.db.one<{ n: number }>(`SELECT COUNT(*) AS n FROM ${q(this.table)} ${whereSql}`, params);
      count = Number(c?.n ?? 0);
    }
    if (this.s.head) return { data: null, error: null, count };

    const rows = await fetchRows(this.db, this.scope, this.table, spec, {
      whereSql,
      params,
      orderSql: this.orderSql(info),
      limitSql: this.mode1Limit(),
    });
    return this.shape(rows, count);
  }

  /** single()/maybeSingle() need to see a second row to know the answer was ambiguous. */
  private mode1Limit(): string {
    if (this.s.mode !== "many" && this.s.limit === null) return "LIMIT 2";
    return this.limitSql();
  }

  private prepareRow(info: TableInfo, row: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined) continue;
      if (!info.columns.has(key)) throw new DbError(`column "${key}" does not exist on ${this.table}`, "42703");
      out[key] = toDbValue(info.columns.get(key), value);
    }
    return out;
  }

  private async afterWrite(info: TableInfo, ids: any[][]): Promise<Result> {
    if (!this.s.returning) return { data: null, error: null, count: null };
    if (ids.length === 0) return this.shape([], null);

    const pk = info.primaryKey;
    const spec = parseSelect(this.s.columns);
    const clause = ids.map(() => `(${pk.map((c) => `${q(this.table)}.${q(c)} = ?`).join(" AND ")})`).join(" OR ");
    const rows = await fetchRows(poolDb(), { userId: null, unrestricted: true }, this.table, spec, {
      whereSql: `WHERE ${clause}`,
      params: ids.flat(),
      orderSql: "",
      limitSql: "",
      keepHidden: this.scope.unrestricted,
    });
    return this.shape(rows, null);
  }

  private async runInsert(info: TableInfo): Promise<Result> {
    if (this.s.rows.length === 0) return { data: this.s.mode === "many" ? [] : null, error: null, count: null };

    const pk = info.primaryKey;
    const idColumn = pk.length === 1 && info.columns.get(pk[0]!) === "text" && pk[0] === "id" ? "id" : null;
    const keys: any[][] = [];
    const isUpsert = this.s.op === "upsert";

    for (const raw of this.s.rows) {
      const row: Record<string, any> = { ...raw };
      if (idColumn && row[idColumn] === undefined) row[idColumn] = newId();

      if (!(await canInsertRow(this.scope, this.table, row))) {
        throw denied(`new row violates row-level security policy for table "${this.table}"`);
      }

      const prepared = await runBeforeWrite(this.db, this.scope, this.table, "insert", this.prepareRow(info, row), null);
      const columns = Object.keys(prepared);
      const placeholders = columns.map(() => "?").join(",");
      let sql = `INSERT ${isUpsert && this.s.ignoreDuplicates ? "IGNORE " : ""}INTO ${q(this.table)} (${columns.map(q).join(",")}) VALUES (${placeholders})`;

      if (isUpsert && !this.s.ignoreDuplicates) {
        const conflict = new Set(this.s.onConflict ?? pk);
        const updates = columns.filter((c) => !conflict.has(c));
        sql += updates.length
          ? ` ON DUPLICATE KEY UPDATE ${updates.map((c) => `${q(c)} = VALUES(${q(c)})`).join(", ")}`
          : ` ON DUPLICATE KEY UPDATE ${q(columns[0]!)} = ${q(columns[0]!)}`;
      }

      await this.db.run(sql, columns.map((c) => prepared[c]));

      if (this.s.returning) {
        if (idColumn) keys.push([prepared[idColumn]]);
        else keys.push(pk.map((c) => prepared[c]));
      }
    }
    return this.afterWrite(info, keys);
  }

  private async matchingKeys(info: TableInfo, op: Op) {
    const { sql, params } = await this.where(info, op);
    const rows = await this.db.all<Record<string, any>>(
      `SELECT ${q(this.table)}.* FROM ${q(this.table)} ${sql} ${this.orderSql(info)} ${this.s.limit !== null ? this.limitSql() : ""}`,
      params,
    );
    return rows;
  }

  private async runUpdate(info: TableInfo): Promise<Result> {
    const matched = await this.matchingKeys(info, "update");
    const pk = info.primaryKey;
    const keys: any[][] = [];

    for (const current of matched) {
      const old = fromDbRow(info, current);
      const merged = await runBeforeWrite(this.db, this.scope, this.table, "update", this.prepareRow(info, this.s.values), old);
      const columns = Object.keys(merged);
      if (columns.length > 0) {
        await this.db.run(
          `UPDATE ${q(this.table)} SET ${columns.map((c) => `${q(c)} = ?`).join(", ")} WHERE ${pk.map((c) => `${q(c)} = ?`).join(" AND ")}`,
          [...columns.map((c) => merged[c]), ...pk.map((c) => current[c])],
        );
      }
      keys.push(pk.map((c) => current[c]));
    }
    return this.afterWrite(info, keys);
  }

  private async runDelete(info: TableInfo): Promise<Result> {
    const matched = await this.matchingKeys(info, "delete");
    const pk = info.primaryKey;
    // Return values must be read before the rows disappear.
    let returned: Result | null = null;
    if (this.s.returning && matched.length) {
      const spec = parseSelect(this.s.columns);
      const clause = matched.map(() => `(${pk.map((c) => `${q(this.table)}.${q(c)} = ?`).join(" AND ")})`).join(" OR ");
      const rows = await fetchRows(poolDb(), { userId: null, unrestricted: true }, this.table, spec, {
        whereSql: `WHERE ${clause}`,
        params: matched.flatMap((m) => pk.map((c) => m[c])),
        orderSql: "",
        limitSql: "",
      });
      returned = this.shape(rows, null);
    }

    for (const current of matched) {
      const old = fromDbRow(info, current);
      await runBeforeWrite(this.db, this.scope, this.table, "delete", {}, old);
      await this.db.run(`DELETE FROM ${q(this.table)} WHERE ${pk.map((c) => `${q(c)} = ?`).join(" AND ")}`, pk.map((c) => current[c]));
    }
    if (!this.s.returning) return { data: null, error: null, count: null };
    return returned ?? this.shape([], null);
  }
}

// ---------------------------------------------------------------- reading rows (with embedded relations)

type FetchOptions = {
  whereSql: string;
  params: any[];
  orderSql: string;
  limitSql: string;
  keepHidden?: boolean;
};

function visibleColumns(info: TableInfo, keepHidden: boolean): string[] {
  return [...info.columns.keys()].filter((c) => keepHidden || !HIDDEN_COLUMNS.has(c));
}

function pick(row: Record<string, any>, spec: SelectSpec, info: TableInfo, keepHidden: boolean): Record<string, any> {
  const out: Record<string, any> = {};
  if (spec.all) {
    for (const c of visibleColumns(info, keepHidden)) out[c] = row[c];
  }
  for (const c of spec.cols) {
    if (!info.columns.has(c.name)) throw new DbError(`column "${c.name}" does not exist on ${info.name}`, "42703");
    if (HIDDEN_COLUMNS.has(c.name) && !keepHidden) throw new DbError(`permission denied for column "${c.name}"`, "42501");
    out[c.alias] = row[c.name];
  }
  return out;
}

export async function fetchRows(
  db: Db,
  scope: Scope,
  table: string,
  spec: SelectSpec,
  options: FetchOptions,
): Promise<Record<string, any>[]> {
  const meta = await getMeta();
  const info = meta.tables.get(table);
  if (!info) throw new DbError(`relation "${table}" does not exist`, "42P01");

  const keepHidden = Boolean(options.keepHidden);
  // Read every visible column: relations need their join columns, and projecting afterwards is cheap.
  const needsAll = spec.all || spec.embeds.length > 0;
  const wanted = needsAll
    ? visibleColumns(info, keepHidden)
    : spec.cols.map((c) => {
        if (!info.columns.has(c.name)) throw new DbError(`column "${c.name}" does not exist on ${table}`, "42703");
        if (HIDDEN_COLUMNS.has(c.name) && !keepHidden) throw new DbError(`permission denied for column "${c.name}"`, "42501");
        return c.name;
      });

  const select = [...new Set(wanted)].map((c) => `${q(table)}.${q(c)}`).join(", ");
  const raw = await db.all<Record<string, any>>(
    `SELECT ${select} FROM ${q(table)} ${options.whereSql} ${options.orderSql} ${options.limitSql}`,
    options.params,
  );
  const rows = raw.map((r) => fromDbRow(info, r));

  const result = rows.map((r) => pick(r, spec, info, keepHidden));

  for (const embed of spec.embeds) {
    await attachEmbed(db, scope, info, rows, result, embed, keepHidden);
  }
  return result;
}

async function attachEmbed(
  db: Db,
  scope: Scope,
  parent: TableInfo,
  parentRows: Record<string, any>[],
  out: Record<string, any>[],
  embed: Embed,
  keepHidden: boolean,
) {
  const meta = await getMeta();
  const related = meta.tables.get(embed.table);
  if (!related) throw new DbError(`Could not find a relationship between ${parent.name} and ${embed.table}`, "PGRST200");

  // parent → related (many-to-one) first, then related → parent (one-to-many).
  const toOne = parent.foreignKeys.filter(
    (fk) => fk.refTable === embed.table && (!embed.hint || fk.column === embed.hint || embed.hint.includes(fk.column)),
  )[0];
  const toMany = related.foreignKeys.filter(
    (fk) => fk.refTable === parent.name && (!embed.hint || fk.column === embed.hint || embed.hint.includes(fk.column)),
  )[0];
  const link = toOne ?? toMany;
  if (!link) throw new DbError(`Could not find a relationship between ${parent.name} and ${embed.table}`, "PGRST200");

  const many = !toOne;
  const parentKey = many ? link.refColumn : link.column;
  const relatedKey = many ? link.column : link.refColumn;

  const keys = [...new Set(parentRows.map((r) => r[parentKey]).filter((v) => v !== null && v !== undefined))];
  if (keys.length === 0) {
    out.forEach((o) => (o[embed.key] = many ? [] : null));
    return;
  }

  const policy = await rowCondition(scope, embed.table, "select", embed.table);
  const whereParts = [`${q(embed.table)}.${q(relatedKey)} IN (${keys.map(() => "?").join(",")})`];
  const params: any[] = [...keys];
  if (policy) {
    whereParts.push(policy.sql);
    params.push(...policy.params);
  }

  // Ask for the join column too, then project back to what was requested.
  const spec: SelectSpec = {
    all: embed.cols.all,
    cols: [...embed.cols.cols, { name: relatedKey, alias: `__join_${relatedKey}` }],
    embeds: embed.cols.embeds,
  };
  const relatedRows = await fetchRows(db, scope, embed.table, spec, {
    whereSql: `WHERE ${whereParts.join(" AND ")}`,
    params,
    orderSql: "",
    limitSql: "",
    keepHidden,
  });

  const joinAlias = `__join_${relatedKey}`;
  const groups = new Map<any, Record<string, any>[]>();
  for (const row of relatedRows) {
    const key = row[joinAlias];
    delete row[joinAlias];
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  parentRows.forEach((row, index) => {
    const list = groups.get(row[parentKey]) ?? [];
    out[index]![embed.key] = many ? list.map((r) => ({ ...r })) : list[0] ? { ...list[0] } : null;
  });
}

