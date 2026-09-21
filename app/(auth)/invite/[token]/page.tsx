import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { AcceptInvitation } from "@/components/auth/accept-invitation";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/user";

const t = getMessages("en");

export const metadata: Metadata = { title: t.invite.title };
export const dynamic = "force-dynamic";

type Preview = {
  status: "open" | "not_found" | "revoked" | "accepted" | "expired";
  organization_name?: string;
  email?: string;
  role?: "manager" | "staff";
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data }, user] = await Promise.all([
    supabase.rpc("invitation_preview", { p_token: token }),
    getCurrentUser(),
  ]);

  const preview = (data ?? { status: "not_found" }) as Preview;
  const next = `/invite/${token}`;

  return (
    <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lg sm:p-10">
      <h1 className="mb-4 text-2xl font-bold">{t.invite.title}</h1>

      {preview.status !== "open" ? (
        <FormNotice tone="error">{t.invite.status[preview.status]}</FormNotice>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-base text-brand-dark">
              {t.invite.joinAs
                .replace("{organization}", preview.organization_name ?? "")
                .replace("{role}", preview.role === "manager" ? t.team.roles.manager : t.team.roles.staff)}
            </p>
            <p className="text-sm text-text-secondary">
              {t.invite.forEmail.replace("{email}", preview.email ?? "")}
            </p>
          </div>

          {!user ? (
            // Not signed in: go and do that, then come straight back here.
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-secondary">{t.invite.signInFirst}</p>
              <Button asChild size="lg" className="w-full">
                <Link href={`/signup?next=${encodeURIComponent(next)}`}>{t.invite.signUp}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full">
                <Link href={`/login?next=${encodeURIComponent(next)}`}>{t.invite.signIn}</Link>
              </Button>
            </div>
          ) : user.email?.toLowerCase() !== preview.email ? (
            // Signed in as somebody else. Say so plainly rather than failing on click.
            <div className="flex flex-col gap-3">
              <FormNotice tone="error">
                {t.invite.wrongEmail.replace("{email}", preview.email ?? "")}
              </FormNotice>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  {t.invite.signOut}
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-text-muted">
                {t.invite.signedInAs.replace("{email}", user.email ?? "")}
              </p>
              <AcceptInvitation copy={t.invite} token={token} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
