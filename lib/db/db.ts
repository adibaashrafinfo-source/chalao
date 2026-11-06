/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { getPool } from "@/lib/db/pool";
import { toDbError } from "@/lib/db/errors";

/** The few things the rest of the code needs from a connection or the pool. */
export type Db = {
  all<T = any>(sql: string, params?: any[]): Promise<T[]>;
  one<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<ResultSetHeader>;
};

function wrap(runner: { query: (sql: string, params?: any[]) => Promise<any> }): Db {
  const exec = async (sql: string, params?: any[]) => {
    try {
      const [result] = await runner.query(sql, params);
      return result;
    } catch (error) {
      throw toDbError(error);
    }
  };
  return {
    all: async (sql, params) => (await exec(sql, params)) as any[],
    one: async (sql, params) => ((await exec(sql, params)) as any[])[0],
    run: async (sql, params) => (await exec(sql, params)) as ResultSetHeader,
  };
}

export function poolDb(): Db {
  return wrap(getPool());
}

/** Runs `fn` in one transaction. Any thrown error rolls everything back. */
export async function withTx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  let connection: PoolConnection;
  try {
    connection = await getPool().getConnection();
  } catch (error) {
    throw toDbError(error);
  }

  try {
    await connection.beginTransaction();
    const result = await fn(wrap(connection));
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // The original error is the one worth reporting.
    }
    throw toDbError(error);
  } finally {
    connection.release();
  }
}

export const newId = () => crypto.randomUUID();
