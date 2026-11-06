/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Errors keep the shape the rest of the app already reads: `message` and a five-character
 * `code`. The two codes the screens look for are the standard ones:
 *   23505  duplicate value in a unique column
 *   23503  row is still referenced by another table
 */
export type DbErrorShape = { message: string; code: string; details: string | null; hint: string | null };

export class DbError extends Error {
  code: string;
  details: string | null = null;
  hint: string | null = null;

  constructor(message: string, code = "P0001") {
    super(message);
    this.name = "DbError";
    this.code = code;
  }

  toJSON(): DbErrorShape {
    return { message: this.message, code: this.code, details: this.details, hint: this.hint };
  }
}

/** A rule was broken, such as a stock level going negative. */
export const checkViolation = (message: string) => new DbError(message, "23514");
/** The signed-in person is not allowed to do this. */
export const denied = (message: string) => new DbError(message, "42501");
export const notFound = (message: string) => new DbError(message, "P0002");

/** Turns a driver error into the app's error shape. */
export function toDbError(error: unknown): DbError {
  if (error instanceof DbError) return error;

  const e = error as any;
  const errno: number | undefined = e?.errno;
  const sqlMessage: string = e?.sqlMessage ?? e?.message ?? String(error);

  if (errno === 1062) {
    const key = /for key '([^']+)'/.exec(sqlMessage)?.[1] ?? "unique";
    return new DbError(`duplicate key value violates unique constraint "${key}"`, "23505");
  }
  if (errno === 1451) {
    return new DbError("update or delete violates a foreign key constraint: the row is still in use", "23503");
  }
  if (errno === 1452) {
    return new DbError("insert or update violates a foreign key constraint: the referenced row does not exist", "23503");
  }
  if (errno === 1048) return new DbError(sqlMessage, "23502");
  if (errno === 1406) return new DbError(sqlMessage, "22001");
  if (errno === 1264 || errno === 1366 || errno === 1292) return new DbError(sqlMessage, "22P02");
  if (e?.code === "ECONNREFUSED" || e?.code === "ETIMEDOUT" || e?.code === "ENOTFOUND") {
    return new DbError(`Cannot reach the database (${e.code}). Check DB_HOST, DB_USER, DB_PASSWORD and DB_NAME.`, "08006");
  }
  if (errno === 1045 || errno === 1044) {
    return new DbError("The database refused the login. Check DB_USER and DB_PASSWORD.", "28P01");
  }
  return new DbError(sqlMessage, "XX000");
}
