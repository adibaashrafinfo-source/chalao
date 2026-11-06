import "server-only";

import path from "node:path";

/**
 * Where uploaded files (business logos) are kept on this server.
 * Set UPLOAD_DIR to a folder outside the app folder (for example /home/USER/chalao-uploads)
 * so a new app upload never wipes the files. Defaults to ./uploads next to the app.
 */
export function uploadRoot(): string {
  return path.resolve(process.env["UPLOAD_DIR"] || path.join(process.cwd(), "uploads"));
}

/** The absolute path for a relative upload path, or null if it tries to leave the upload folder. */
export function safeUploadPath(relative: string): string | null {
  const root = uploadRoot();
  const full = path.resolve(root, relative);
  return full === root || full.startsWith(root + path.sep) ? full : null;
}

export const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};
