import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/db/server";
import { getMembership } from "@/lib/db/queries";
import { LOGO_TYPES, safeUploadPath } from "@/lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 1_000_000;

async function clearLogoFiles(dir: string) {
  try {
    for (const name of await readdir(dir)) {
      if (name.startsWith("logo.")) await rm(path.join(dir, name), { force: true });
    }
  } catch {
    // The folder does not exist yet: nothing to clear.
  }
}

/** Only the owner changes the business logo. */
async function ownerOrganization() {
  const membership = await getMembership();
  if (!membership) return { error: "Sign in first.", status: 401 as const };
  if (membership.role !== "owner") return { error: "Only the owner can change these details.", status: 403 as const };
  return { organizationId: membership.organizationId };
}

export async function POST(request: Request) {
  const who = await ownerOrganization();
  if ("error" in who) return NextResponse.json({ error: who.error }, { status: who.status });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file was sent." }, { status: 400 });

  const ext = LOGO_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, WebP or SVG image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The image is larger than 1 MB." }, { status: 400 });

  const relativeDir = `logos/${who.organizationId}`;
  const dir = safeUploadPath(relativeDir);
  if (!dir) return NextResponse.json({ error: "Bad path." }, { status: 400 });

  await clearLogoFiles(dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `logo.${ext}`), Buffer.from(await file.arrayBuffer()));

  const url = `/uploads/${relativeDir}/logo.${ext}?v=${Date.now()}`;
  const db = await createClient();
  const { error } = await db.from("organizations").update({ logo_url: url }).eq("id", who.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/settings/organization");
  return NextResponse.json({ url });
}

export async function DELETE() {
  const who = await ownerOrganization();
  if ("error" in who) return NextResponse.json({ error: who.error }, { status: who.status });

  const dir = safeUploadPath(`logos/${who.organizationId}`);
  if (dir) await clearLogoFiles(dir);

  const db = await createClient();
  const { error } = await db.from("organizations").update({ logo_url: null }).eq("id", who.organizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  revalidatePath("/settings/organization");
  return NextResponse.json({ url: null });
}
