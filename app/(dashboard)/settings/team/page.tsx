import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Topbar } from "@/components/dashboard/topbar";
import { TeamManager } from "@/components/settings/team-manager";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/locale";
import { getMembership } from "@/lib/db/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeam, getUserLimit, listOpenInvitations } from "@/lib/team/queries";
import { siteUrl as getSiteUrl } from "@/lib/site-url";

// Page titles are read once per server, so they stay in English.
const tEn = getMessages("en");

export const metadata: Metadata = { title: tEn.team.title };

export default async function TeamPage() {
  // The dictionary is fetched here, not at module level: it is per person.
  const t = await getDictionary();
  const membership = await getMembership();
  if (!membership) redirect("/onboarding");

  const isOwner = membership.role === "owner";

  const [initials, user, members, limit, invitations] = await Promise.all([
    getUserInitials(),
    getCurrentUser(),
    getTeam(membership.organizationId),
    getUserLimit(membership.organizationId),
    // Invitations are the owner's business; nobody else can read them anyway.
    isOwner ? listOpenInvitations(membership.organizationId) : Promise.resolve([]),
  ]);

  // Open invitations count too: each one is a seat someone may take.
  const seatsTaken = members.length + invitations.length;
  const atLimit = limit !== null && seatsTaken >= limit;

  const usage =
    limit === null
      ? t.team.usageUnlimited.replace("{count}", String(members.length))
      : t.team.usage.replace("{count}", String(members.length)).replace("{limit}", String(limit));

  const siteUrl = getSiteUrl();

  return (
    <>
      <Topbar title={t.team.title} subtitle={t.team.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex-1 p-4 sm:p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-5 py-4 shadow-xs">
            <p className="text-sm text-text-secondary">{usage}</p>
            {atLimit && isOwner ? (
              <Link href="/settings/billing" className="text-sm font-medium text-brand-dark underline">
                {t.team.upgrade}
              </Link>
            ) : null}
          </div>

          <TeamManager
            copy={t.team}
            members={members}
            invitations={invitations}
            currentUserId={user?.id ?? ""}
            isOwner={isOwner}
            atLimit={atLimit}
            siteUrl={siteUrl}
          />
        </div>
      </main>
    </>
  );
}
