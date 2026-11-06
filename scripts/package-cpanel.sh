#!/usr/bin/env bash
# Builds the app and zips a folder that can be uploaded to cPanel as it is.
# Usage: bash scripts/package-cpanel.sh      (run from the project root)
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

pnpm build

out="dist/chalao-cpanel"
rm -rf dist
mkdir -p "$out"

cp -R .next/standalone/. "$out/"
# The server needs only Next.js and React at run time (the database driver and the rest are
# already inside the build). They are installed as plain folders, no links, so the zip is
# portable. cPanel swaps a folder named node_modules for its own link, so they go in app_modules.
rm -rf "$out/node_modules"
libs="$(mktemp -d)"
next_v="$(node -p "require('./node_modules/next/package.json').version")"
react_v="$(node -p "require('./node_modules/react/package.json').version")"
react_dom_v="$(node -p "require('./node_modules/react-dom/package.json').version")"
mysql_v="$(node -p "require('./node_modules/mysql2/package.json').version")"
bcrypt_v="$(node -p "require('./node_modules/bcryptjs/package.json').version")"
(cd "$libs" && npm init -y >/dev/null && npm install --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund \
  "next@$next_v" "react@$react_v" "react-dom@$react_dom_v" "mysql2@$mysql_v" "bcryptjs@$bcrypt_v" >/dev/null)
mv "$libs/node_modules" "$out/app_modules"
rm -rf "$out/app_modules/.bin"
rm -rf "$libs"
mkdir -p "$out/.next/static" "$out/public"
cp -R .next/static/. "$out/.next/static/"
cp -R public/. "$out/public/"
cp cpanel/app.js "$out/app.js"
cp cpanel/admin-tool.js "$out/admin-tool.js"
mkdir -p "$out/database"
cp database/schema.sql "$out/database/schema.sql"
cp .env.example "$out/.env.example"
[ -f docs/CPANEL-INSTALL.md ] && cp docs/CPANEL-INSTALL.md "$out/CPANEL-INSTALL.md"

# The standalone build must not carry local secrets or test files.
rm -f "$out/.env" "$out/.env.local"

(cd dist && zip -qr chalao-cpanel.zip chalao-cpanel)
echo "Ready: dist/chalao-cpanel.zip"
