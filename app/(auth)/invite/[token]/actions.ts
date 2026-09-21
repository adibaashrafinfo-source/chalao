"use server";

import { redirect } from "next/navigation";

import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

const t = getMessages("en");

export type AcceptResult = { error?: string };

// The database raises codes, not sentences; these are the ones a person can act on.
const KNOWN_CODES = [
  "INVITE_WRONG_EMAIL",
  "INVITE_ALREADY_MEMBER",
  "USER_LIMIT_REACHED",
  "INVITE_EXPIRED",
  "INVITE_REVOKED",
  "INVITE_USED",
  "INVITE_NOT_FOUND",
] as const;

export async function acceptInvitationAction(token: string): Promise<AcceptResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { p_token: token });

  if (error) {
    const code = KNOWN_CODES.find((known) => error.message.includes(known));
    return { error: code ? t.invite.errors[code] : t.invite.errors.generic };
  }

  redirect("/dashboard");
}
