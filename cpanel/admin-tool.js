// Small helper for the person who runs the server. Run it from cPanel -> Terminal, inside the app folder:
//   node admin-tool.js set-password you@example.com NewPassword123
//   node admin-tool.js make-admin you@example.com
// It reads the same database settings as the app (from .env or the cPanel environment).
const fs = require("fs");
const path = require("path");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(__dirname, ".env"));
const libraries = path.join(__dirname, "app_modules");
if (fs.existsSync(libraries)) {
  process.env.NODE_PATH = [libraries, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require("module").Module._initPaths();
}

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

async function main() {
  const [command, email, password] = process.argv.slice(2);
  if (!command || !email || (command === "set-password" && !password)) {
    console.log("Usage:\n  node admin-tool.js set-password <email> <new-password>\n  node admin-tool.js make-admin <email>");
    process.exit(1);
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [rows] = await db.query("SELECT id FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    if (rows.length === 0) {
      console.log("No account with that email.");
      process.exit(1);
    }
    const id = rows[0].id;

    if (command === "set-password") {
      if (password.length < 8) {
        console.log("Use at least 8 characters.");
        process.exit(1);
      }
      await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [await bcrypt.hash(password, 10), id]);
      console.log("Password changed for", email);
    } else if (command === "make-admin") {
      await db.query("INSERT IGNORE INTO platform_admins (user_id) VALUES (?)", [id]);
      console.log(email, "is now a platform admin.");
    } else {
      console.log("Unknown command:", command);
      process.exit(1);
    }
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("Failed:", error.message);
  process.exit(1);
});
