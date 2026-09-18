import type { Metadata } from "next";
import Link from "next/link";
import { MessagesSquare, Plug } from "lucide-react";

import { Topbar } from "@/components/dashboard/topbar";
import { ContextPanel } from "@/components/inbox/context-panel";
import { ConversationList, type ConversationListRow } from "@/components/inbox/conversation-list";
import { MarkRead } from "@/components/inbox/mark-read";
import { MessageComposer } from "@/components/inbox/message-composer";
import { MessageThread, type ThreadMessage } from "@/components/inbox/message-thread";
import { Button } from "@/components/ui/button";
import { getUserInitials } from "@/lib/dashboard/user";
import { getMessages } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getMembership } from "@/lib/supabase/queries";
import { getCurrentUser } from "@/lib/supabase/user";
import { cn } from "@/lib/utils";

const t = getMessages("en");

export const metadata: Metadata = { title: t.inbox.title };

const STATUS_FILTERS = ["open", "pending", "closed"] as const;

type ConversationRow = {
  id: string;
  external_id: string;
  contact_name: string | null;
  contact_handle: string | null;
  status: "open" | "pending" | "snoozed" | "closed";
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  customer_id: string | null;
  assigned_to: string | null;
  channel_connection_id: string;
  created_at: string;
};

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; status?: string; q?: string }>;
}) {
  const { c: selectedId, status, q } = await searchParams;
  const membership = await getMembership();
  const organizationId = membership?.organizationId ?? "";
  const supabase = await createClient();
  const [initials, user] = await Promise.all([getUserInitials(), getCurrentUser()]);

  const { data: connectionRows } = await supabase
    .from("channel_connections")
    .select("id, provider, label, is_active")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  const connections = connectionRows ?? [];
  const connectionLabels = new Map(connections.map((row) => [row.id as string, row.label as string]));

  const activeStatus = STATUS_FILTERS.includes(status as (typeof STATUS_FILTERS)[number]) ? status : undefined;

  let listQuery = supabase
    .from("conversations")
    .select(
      "id, external_id, contact_name, contact_handle, status, unread_count, last_message_at, last_message_preview, customer_id, assigned_to, channel_connection_id, created_at",
    )
    .eq("organization_id", organizationId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (activeStatus) listQuery = listQuery.eq("status", activeStatus);

  const term = q?.trim();
  if (term) {
    const safe = term.replace(/[%,]/g, "");
    listQuery = listQuery.or(`contact_name.ilike.%${safe}%,last_message_preview.ilike.%${safe}%`);
  }

  const { data: listData } = await listQuery;
  const conversations = (listData ?? []) as ConversationRow[];

  // The open conversation may sit outside the current filter, so it is fetched
  // on its own rather than picked out of the list.
  let selected: ConversationRow | null = null;
  if (selectedId) {
    const { data } = await supabase
      .from("conversations")
      .select(
        "id, external_id, contact_name, contact_handle, status, unread_count, last_message_at, last_message_preview, customer_id, assigned_to, channel_connection_id, created_at",
      )
      .eq("id", selectedId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    selected = (data as ConversationRow | null) ?? null;
  }

  let messages: ThreadMessage[] = [];
  if (selected) {
    const { data } = await supabase
      .from("messages")
      .select("id, direction, author, body, attachments, delivery, error, sent_at, created_at")
      .eq("conversation_id", selected.id)
      .order("created_at", { ascending: true })
      .limit(300);
    messages = (data ?? []) as ThreadMessage[];
  }

  // Customer card in the right-hand panel.
  let customer:
    | { id: string; name: string; phone: string; district: string | null; orderCount: number; lifetime: number }
    | null = null;

  if (selected?.customer_id) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, phone, district, orders(total, status)")
      .eq("id", selected.customer_id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (data) {
      const orders = (data.orders ?? []) as { total: number; status: string }[];
      customer = {
        id: data.id as string,
        name: data.name as string,
        phone: data.phone as string,
        district: (data.district as string | null) ?? null,
        orderCount: orders.length,
        lifetime: orders
          .filter((order) => order.status === "delivered")
          .reduce((sum, order) => sum + Number(order.total), 0),
      };
    }
  }

  // Names for whoever a conversation is assigned to.
  const assigneeIds = Array.from(
    new Set([...conversations, ...(selected ? [selected] : [])].map((row) => row.assigned_to).filter(Boolean)),
  ) as string[];

  const assigneeNames = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", assigneeIds);
    for (const row of data ?? []) {
      assigneeNames.set(row.id as string, (row.full_name as string | null) ?? "");
    }
  }

  const rows: ConversationListRow[] = conversations.map((row) => ({
    id: row.id,
    name: row.contact_name || row.contact_handle || row.external_id,
    preview: row.last_message_preview,
    status: row.status,
    unreadCount: row.unread_count,
    lastMessageAt: row.last_message_at,
    channelLabel: connectionLabels.get(row.channel_connection_id) ?? "",
    isLinked: Boolean(row.customer_id),
  }));

  const hasConnections = connections.length > 0;

  return (
    <>
      <Topbar title={t.inbox.title} subtitle={t.inbox.subtitle} nav={t.dashboard.nav} userInitials={initials} />

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
        {!hasConnections ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-surface px-6 py-20 text-center shadow-xs">
            <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
              <Plug className="size-5" aria-hidden="true" />
            </span>
            <h2 className="text-xl font-semibold">{t.inbox.empty.title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">{t.inbox.empty.body}</p>
            <Button asChild className="mt-2">
              <Link href="/settings/channels">{t.inbox.empty.connect}</Link>
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-col gap-4 lg:h-[calc(100dvh-8rem)] lg:flex-row">
            <ConversationList
              inbox={t.inbox}
              rows={rows}
              selectedId={selected?.id ?? null}
              status={activeStatus ?? null}
              query={term ?? ""}
              className={cn(selected && "hidden lg:flex")}
            />

            <section
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface shadow-xs",
                !selected && "hidden lg:flex",
              )}
            >
              {selected ? (
                <>
                  <MarkRead conversationId={selected.id} unreadCount={selected.unread_count} />
                  <header className="flex items-center justify-between gap-3 border-b border-border-subtle px-5 py-4">
                    <div className="flex min-w-0 flex-col">
                      <h2 className="truncate font-display font-semibold text-brand-dark">
                        {selected.contact_name || selected.contact_handle || selected.external_id}
                      </h2>
                      <p className="truncate text-xs text-text-secondary">
                        {t.inbox.thread.openedVia} {connectionLabels.get(selected.channel_connection_id) ?? ""}
                      </p>
                    </div>
                    <Button asChild variant="ghost" size="sm" className="lg:hidden">
                      <Link href="/inbox">{t.inbox.title}</Link>
                    </Button>
                  </header>

                  <MessageThread inbox={t.inbox} messages={messages} startedAt={selected.created_at} />

                  <MessageComposer
                    inbox={t.inbox}
                    conversationId={selected.id}
                    isClosed={selected.status === "closed"}
                  />
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <span className="flex size-12 items-center justify-center rounded-full bg-surface-alt text-brand-dark">
                    <MessagesSquare className="size-5" aria-hidden="true" />
                  </span>
                  <h2 className="font-display text-lg font-semibold">{t.inbox.noneSelected.title}</h2>
                  <p className="max-w-xs text-sm text-text-secondary">{t.inbox.noneSelected.body}</p>
                </div>
              )}
            </section>

            {selected ? (
              <ContextPanel
                inbox={t.inbox}
                conversationId={selected.id}
                status={selected.status}
                channelLabel={connectionLabels.get(selected.channel_connection_id) ?? ""}
                contactName={selected.contact_name || selected.contact_handle || selected.external_id}
                startedAt={selected.created_at}
                customer={customer}
                assignedToName={selected.assigned_to ? (assigneeNames.get(selected.assigned_to) ?? "") : null}
                assignedToMe={Boolean(user && selected.assigned_to === user.id)}
              />
            ) : null}
          </div>
        )}
      </main>
    </>
  );
}
