"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, Paperclip } from "lucide-react";

import type { Messages } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ThreadMessage = {
  id: string;
  direction: "inbound" | "outbound";
  author: "customer" | "agent" | "ai" | "system";
  body: string | null;
  attachments: { type: string; url: string; name?: string }[];
  delivery: "received" | "queued" | "sent" | "delivered" | "read" | "failed";
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
const dayFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export function MessageThread({
  inbox,
  messages,
  startedAt,
}: {
  inbox: Messages["inbox"];
  messages: ThreadMessage[];
  startedAt: string;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  // A thread opens at its newest message, like every messaging app.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  let lastDay = "";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
      <p className="text-center text-[11px] text-text-muted">
        {inbox.thread.start} · {dayFormatter.format(new Date(startedAt))}
      </p>

      {messages.map((message) => {
        const at = new Date(message.sent_at ?? message.created_at);
        const day = dayFormatter.format(at);
        const showDay = day !== lastDay;
        lastDay = day;

        const outbound = message.direction === "outbound";

        return (
          <div key={message.id} className="flex flex-col gap-3">
            {showDay ? <p className="text-center text-[11px] text-text-muted">{day}</p> : null}

            <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "flex max-w-[min(32rem,80%)] flex-col gap-1 rounded-2xl px-4 py-2.5",
                  outbound ? "bg-brand-dark text-white" : "bg-surface-alt text-brand-dark",
                )}
              >
                {message.body ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                ) : null}

                {message.attachments.map((attachment, index) => (
                  <a
                    key={`${message.id}-${index}`}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={cn(
                      "flex items-center gap-2 text-xs underline underline-offset-2",
                      outbound ? "text-white/90" : "text-text-secondary",
                    )}
                  >
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    {attachment.name ?? inbox.thread.attachment}
                  </a>
                ))}

                <span
                  className={cn(
                    "flex items-center gap-1.5 self-end text-[11px]",
                    outbound ? "text-white/70" : "text-text-muted",
                  )}
                >
                  {message.author === "ai" ? `${inbox.list.assistant} · ` : null}
                  {timeFormatter.format(at)}
                  {outbound && message.delivery === "queued" ? ` · ${inbox.thread.queued}` : null}
                </span>

                {message.delivery === "failed" ? (
                  <span className="flex items-center gap-1.5 self-end text-[11px] text-danger">
                    <AlertCircle className="size-3.5" aria-hidden="true" />
                    {inbox.thread.failed}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={endRef} />
    </div>
  );
}
