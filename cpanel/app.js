// Startup file for cPanel -> Setup Node.js App ("Application startup file": app.js).
// It loads an optional .env file, then starts the Next.js server that sits next to it.
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Values typed into the cPanel screen win over the file.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

process.chdir(__dirname);
loadEnvFile(path.join(__dirname, ".env"));

// The libraries live in "app_modules", not "node_modules": cPanel replaces a folder called
// node_modules with its own link, which would hide them. Node is told where to look instead.
const libraries = path.join(__dirname, "app_modules");
if (fs.existsSync(libraries)) {
  process.env.NODE_PATH = [libraries, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
  require("module").Module._initPaths();
}

process.env.NODE_ENV = "production";
// Bind on every interface; Passenger decides the real port itself.
process.env.HOSTNAME = "0.0.0.0";

require("./server.js");
