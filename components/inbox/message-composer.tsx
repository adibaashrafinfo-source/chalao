"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Send } from "lucide-react";

import { sendReplyAction } from "@/app/(dashboard)/inbox/actions";
import { Button } from "@/components/ui/button";
import type { Messages } from "@/lib/i18n";

export function MessageComposer({
  inbox,
  conversationId,
  isClosed,
}: {
  inbox: Messages["inbox"];
  conversationId: string;
  isClosed: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const send = () => {
    const text = body.trim();
    if (!text || pending) return;

    setError(null);
    // Clear the box straight away; if sending fails the message is still stored
    // and shown in the thread, marked as not delivered.
    setBody("");

    startTransition(async () => {
      const result = await sendReplyAction(conversationId, text);
      if (result.error) setError(result.error);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-2 border-t border-border-subtle p-4">
      {isClosed ? <p className="text-xs text-text-secondary">{inbox.composer.closedNotice}</p> : null}
      {error ? <p className="text-xs text-danger">{error}</p> : null}

      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={inbox.composer.placeholder}
          aria-label={inbox.composer.placeholder}
          className="min-h-11 flex-1 resize-none rounded-2xl bg-surface-alt px-4 py-3 text-sm outline-none placeholder:text-text-muted focus-visible:ring-[3px] focus-visible:ring-ring/60"
        />
        <Button type="button" onClick={send} disabled={pending || !body.trim()} className="shrink-0">
          <Send className="size-4" aria-hidden="true" />
          {pending ? inbox.composer.sending : inbox.composer.send}
        </Button>
      </div>

      <p className="text-[11px] text-text-muted">{inbox.composer.hint}</p>
    </div>
  );
}
