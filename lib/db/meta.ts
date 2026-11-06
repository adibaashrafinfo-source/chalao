import "server-only";

import { poolDb } from "@/lib/db/db";

/**
 * What the database says about its own tables, read once per server process.
 * Reading it instead of hard-coding it means a column added to the schema works
 * without touching this code.
 */
export type ColumnKind = "text" | "int" | "num" | "bool" | "json" | "ts" | "date";

export type TableInfo = {
  name: string;
  columns: Map<string, ColumnKind>;
  primaryKey: string[];
  foreignKeys: { column: string; refTable: string; refColumn: string }[];
};

export type Meta = { tables: Map<string, TableInfo> };

let cached: Promise<Meta> | null = null;

export function getMeta(): Promise<Meta> {
  if (!cached) {
    cached = loadMeta().catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}

function kindOf(dataType: string, columnType: string, comment: string): ColumnKind {
  const type = dataType.toLowerCase();
  if (type === "json" || comment === "json") return "json";
  if (type === "tinyint" && columnType.toLowerCase().startsWith("tinyint(1)")) return "bool";
  if (["tinyint", "smallint", "mediumint", "int", "integer", "bigint"].includes(type)) return "int";
  if (["decimal", "numeric", "float", "double"].includes(type)) return "num";
  if (type === "datetime" || type === "timestamp") return "ts";
  if (type === "date") return "date";
  return "text";
}

async function loadMeta(): Promise<Meta> {
  const db = poolDb();

  const columns = await db.all<{ t: string; c: string; d: string; ct: string; cm: string; k: string }>(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, DATA_TYPE AS d, COLUMN_TYPE AS ct,
            COLUMN_COMMENT AS cm, COLUMN_KEY AS k
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  );
  const keys = await db.all<{ t: string; c: string; rt: string; rc: string }>(
    `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, REFERENCED_TABLE_NAME AS rt, REFERENCED_COLUMN_NAME AS rc
       FROM information_schema.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL`,
  );

  const tables = new Map<string, TableInfo>();
  for (const row of columns) {
    let info = tables.get(row.t);
    if (!info) {
      info = { name: row.t, columns: new Map(), primaryKey: [], foreignKeys: [] };
      tables.set(row.t, info);
    }
    info.columns.set(row.c, kindOf(row.d, row.ct, row.cm));
    if (row.k === "PRI") info.primaryKey.push(row.c);
  }
  for (const key of keys) {
    tables.get(key.t)?.foreignKeys.push({ column: key.c, refTable: key.rt, refColumn: key.rc });
  }

  if (tables.size === 0) {
    throw new Error("The database has no Chalao tables. Import database/schema.sql first.");
  }
  return { tables };
}
