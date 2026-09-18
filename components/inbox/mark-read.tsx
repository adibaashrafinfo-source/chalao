"use client";

import { useEffect, useRef } from "react";

import { markConversationReadAction } from "@/app/(dashboard)/inbox/actions";

/**
 * Clears the unread badge once a conversation is on screen.
 *
 * Reading is a side effect, so it cannot happen while the page renders — this
 * calls the action after the thread is shown, and only when there is something
 * to clear.
 */
export function MarkRead({ conversationId, unreadCount }: { conversationId: string; unreadCount: number }) {
  const done = useRef<string | null>(null);

  useEffect(() => {
    if (unreadCount < 1) return;
    if (done.current === conversationId) return;
    done.current = conversationId;
    void markConversationReadAction(conversationId);
  }, [conversationId, unreadCount]);

  return null;
}
