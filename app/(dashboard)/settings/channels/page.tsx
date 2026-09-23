import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

import { ChannelCard, type ChannelRow } from "@/components/channels/channel-card";
import { ConnectChannel } from "@/components/channels/connect-channel";
import { Topbar } from "@/components/dashboard/topbar";
import { listChannelAdapters } from "@/lib/channels/registry";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";

const t = getMessages("en");

export const metadata: Metadata = { title: t.channels.title };

export default async function ChannelsPage() {
  const membership = await getMembership();
  const organizationId = membership?.organizationId ?? "";
  const supabase = await createClient();
  const initials = await getUserInitials();

  const { data, error } = await supabase
    .from("channel_connections")
    .select("id, provider, label, external_id, is_active, last_event_at, webhook_token")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  const connections = (data ?? []) as ChannelRow[];

  // One count per channel, for the card.
  const conversationCounts = new Map<string, number>();
  if (connections.length > 0) {
    const { data: conversationRows } = await supabase
      .from("conversations")
      .select("channel_connection_id")
      .eq("organization_id", organizationId);

    for (const row of conversationRows ?? []) {
      const key = row.channel_connection_id as string;
      conversationCounts.set(key, (conversationCounts.get(key) ?? 0) + 1);
    }
  }

  const providers = listChannelAdapters().map((adapter) => ({
    provider: adapter.provider,
    label: adapter.label,
    description: adapter.description,
    credentialFields: adapter.credentialFields,
  }));

  const webhookBaseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return (
    <>
      <Topbar title={t.channels.title} subtitle={t.channels.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        <div className="flex justify-end">
          <ConnectChannel canManage={can(membership?.role, "manage_channels")} channels={t.channels} providers={providers} />
        </div>

        {error ? (
          <p className="rounded-xl bg-danger-tint px-6 py-5 text-sm text-danger">{error.message}</p>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <MessagesSquare className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{t.channels.empty.title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.channels.empty.body}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {connections.map((connection) => (
              <ChannelCard
                key={connection.id}
                channels={t.channels}
                connection={connection}
                conversationCount={conversationCounts.get(connection.id) ?? 0}
                webhookBaseUrl={webhookBaseUrl}
              />
            ))}
          </div>
        )}

        {/* Said plainly, so nobody waits for a Facebook option that cannot appear yet. */}
        <section className="flex flex-col gap-1 rounded-xl bg-surface p-5 shadow-xs">
          <h2 className="font-display text-sm font-semibold text-brand-dark">{t.channels.meta.title}</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">{t.channels.meta.body}</p>
        </section>
      </main>
    </>
  );
}
