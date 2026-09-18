"use client";

import { Check, Copy, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteChannelAction,
  setChannelActiveAction,
  simulateInboundAction,
} from "@/app/(dashboard)/settings/channels/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";

export type ChannelRow = {
  id: string;
  provider: string;
  label: string;
  external_id: string;
  is_active: boolean;
  last_event_at: string | null;
  webhook_token: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ChannelCard({
  channels,
  connection,
  conversationCount,
  webhookBaseUrl,
}: {
  channels: Messages["channels"];
  connection: ChannelRow;
  conversationCount: number;
  webhookBaseUrl: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fields for the test message. The sender id is what makes two test messages
  // land in the same conversation.
  const [senderName, setSenderName] = useState("Test customer");
  const [threadId, setThreadId] = useState("test-1");
  const [body, setBody] = useState("");

  const webhookUrl = connection.webhook_token
    ? `${webhookBaseUrl}/api/webhooks/channels/${connection.provider}?token=${connection.webhook_token}`
    : null;

  const run = async (action: () => Promise<{ error?: string }>, okText?: string) => {
    setPending(true);
    setMessage(null);
    const result = await action();
    setPending(false);

    if (result?.error) {
      setMessage({ tone: "error", text: result.error });
      return;
    }

    if (okText) setMessage({ tone: "info", text: okText });
    router.refresh();
  };

  const copy = async () => {
    if (!webhookUrl) return;
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-brand-dark">{connection.label}</h2>
            <Badge variant={connection.is_active ? "success" : "neutral"}>
              {connection.is_active ? channels.status.active : channels.status.inactive}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">{connection.external_id}</p>
          <p className="text-xs text-text-muted">
            {channels.lastEvent}:{" "}
            {connection.last_event_at
              ? dateTimeFormatter.format(new Date(connection.last_event_at))
              : channels.never}{" "}
            · {conversationCount} {channels.conversationCount}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setChannelActiveAction(connection.id, !connection.is_active))}
          >
            {connection.is_active ? channels.deactivate : channels.activate}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-tint">
                <Trash2 />
              </Button>
            </DialogTrigger>
            <DialogContent title={channels.deleteConfirmTitle} description={channels.deleteConfirmBody}>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => run(() => deleteChannelAction(connection.id))}
                >
                  {channels.deleteConfirm}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {message ? <FormNotice tone={message.tone}>{message.text}</FormNotice> : null}

      {webhookUrl ? (
        <section className="flex flex-col gap-2 rounded-lg bg-surface-alt p-4">
          <h3 className="font-display text-sm font-semibold text-brand-dark">{channels.webhook.title}</h3>
          <p className="text-xs text-text-secondary">{channels.webhook.body}</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-3 py-2 text-xs text-text-secondary">
              {webhookUrl}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? channels.webhook.copied : channels.webhook.copy}
            </Button>
          </div>
          <p className="text-xs text-text-muted">{channels.webhook.keepSecret}</p>
        </section>
      ) : null}

      {connection.provider === "mock" ? (
        <section className="flex flex-col gap-3 rounded-lg bg-surface-alt p-4">
          <div className="flex flex-col gap-1">
            <h3 className="font-display text-sm font-semibold text-brand-dark">{channels.simulate.title}</h3>
            <p className="text-xs text-text-secondary">{channels.simulate.body}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`sim-name-${connection.id}`}>{channels.simulate.from}</Label>
              <Input
                id={`sim-name-${connection.id}`}
                value={senderName}
                onChange={(event) => setSenderName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`sim-thread-${connection.id}`}>{channels.simulate.thread}</Label>
              <Input
                id={`sim-thread-${connection.id}`}
                value={threadId}
                onChange={(event) => setThreadId(event.target.value)}
              />
              <p className="text-xs text-text-muted">{channels.simulate.threadHelp}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`sim-body-${connection.id}`}>{channels.simulate.message}</Label>
            <Input
              id={`sim-body-${connection.id}`}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <Button
            type="button"
            size="sm"
            disabled={pending || !body.trim()}
            className="self-start"
            onClick={() =>
              run(async () => {
                const result = await simulateInboundAction({
                  connectionId: connection.id,
                  threadId,
                  name: senderName,
                  body,
                });
                if (!result.error) setBody("");
                return result;
              }, channels.simulate.sent)
            }
          >
            <Send className="size-4" aria-hidden="true" />
            {pending ? channels.simulate.sending : channels.simulate.send}
          </Button>
        </section>
      ) : null}
    </article>
  );
}
