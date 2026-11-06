import "server-only";

/**
 * The public address of this site (for example https://app.example.com), set as SITE_URL in
 * the app's environment. Read when a page is shown, so one build works on any domain.
 */
export function siteUrl(): string {
  return (process.env["SITE_URL"] ?? "http://localhost:3000").replace(/\/+$/, "");
}
