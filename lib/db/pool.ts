import "server-only";

import mysql from "mysql2/promise";

const globalForPool = globalThis as unknown as { __chalaoPool?: mysql.Pool };

/**
 * One MySQL connection pool per server process.
 *
 * Settings come from environment variables (set them in cPanel → Setup Node.js App,
 * or in a .env.production file next to the app):
 *   DB_HOST (default localhost), DB_PORT (3306), DB_USER, DB_PASSWORD, DB_NAME
 *
 * Everything is stored and compared in UTC, so the session time zone is pinned on every
 * new connection no matter what the hosting server uses.
 */
export function getPool(): mysql.Pool {
  if (!globalForPool.__chalaoPool) {
    const pool = mysql.createPool({
      host: process.env["DB_HOST"] || "localhost",
      port: Number(process.env["DB_PORT"] || 3306),
      user: process.env["DB_USER"],
      password: process.env["DB_PASSWORD"],
      database: process.env["DB_NAME"],
      charset: "utf8mb4",
      timezone: "Z",
      dateStrings: true,
      decimalNumbers: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
      waitForConnections: true,
      connectionLimit: Number(process.env["DB_POOL"] || 5),
      queueLimit: 0,
      enableKeepAlive: true,
      connectTimeout: 10_000,
    });
    pool.on("connection", (connection) => {
      connection.query("SET time_zone = '+00:00'");
    });
    globalForPool.__chalaoPool = pool;
  }
  return globalForPool.__chalaoPool;
}

export function hasDatabaseConfig(): boolean {
  return Boolean(process.env["DB_NAME"] && process.env["DB_USER"]);
}
