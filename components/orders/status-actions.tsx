"use client";

import { Info } from "lucide-react";
import { useState } from "react";

import { transitionOrderStatusAction } from "@/app/(dashboard)/orders/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { nextStatuses } from "@/lib/orders/status";

// Only the moves the state machine allows are offered — never a dropdown of every status.
export function StatusActions({
  orders,
  orderId,
  status,
  canCancel,
}: {
  orders: Messages["orders"];
  orderId: string;
  status: string;
  /** Cancelling returns stock and loses the sale, so staff do not see the button. */
  canCancel: boolean;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const moves = nextStatuses(status).filter((move) => canCancel || move !== "cancelled");
  // "new" has no button of its own, so the message keys are a loose lookup.
  const actionLabel = orders.statusActions as Record<string, string>;

  const run = async (next: string) => {
    setPending(next);
    setError(null);
    const result = await transitionOrderStatusAction(orderId, next, note);
    setPending(null);
    if (result?.error) setError(result.error);
    else setNote("");
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-base font-semibold text-brand-dark">{orders.statusActions.title}</h2>

      {status === "ready_to_ship" && moves.length === 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-surface-alt px-4 py-3 text-sm text-text-secondary">
          <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          {orders.statusActions.courierWaiting}
        </p>
      )}

      {moves.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status-note">{orders.statusActions.noteLabel}</Label>
            <Input
              id="status-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={orders.statusActions.notePlaceholder}
            />
          </div>

          {status === "new" && <p className="text-xs text-text-secondary">{orders.statusActions.confirmHint}</p>}

          <div className="flex flex-wrap gap-2">
            {moves.map((move, index) => {
              const destructive = move === "cancelled" || move === "returned";
              return (
                <Button
                  key={move}
                  type="button"
                  // One bright button per view: the forward move. Others stay outline.
                  variant={destructive ? "outline" : index === 0 ? "default" : "outline"}
                  className={destructive ? "text-danger" : undefined}
                  disabled={pending !== null}
                  onClick={() => run(move)}
                >
                  {actionLabel[move] ?? move}
                </Button>
              );
            })}
          </div>
        </>
      )}

      {error && <FormNotice tone="error">{error}</FormNotice>}
    </section>
  );
}
