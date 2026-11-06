/* eslint-disable @typescript-eslint/no-explicit-any */
import "server-only";

import { poolDb } from "@/lib/db/db";
import { QueryBuilder } from "@/lib/db/query";
import { callRpc } from "@/lib/db/rpc";
import type { Scope } from "@/lib/db/policies";

/**
 * The object the rest of the app talks to. `from()` and `rpc()` have the same shape the
 * old hosted client had, so call sites barely changed.
 */
export type DbClient = {
  from(table: string): QueryBuilder;
  rpc(name: string, args?: Record<string, any>): PromiseLike<{ data: any; error: any; count: null }>;
};

export function makeClient(scope: Scope): DbClient {
  return {
    from: (table) => new QueryBuilder(table, scope, poolDb()),
    rpc: (name, args) => callRpc(scope, name, args ?? {}) as any,
  };
}
