"use client";

import { Check, Copy, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteCourierAction,
  setCourierActiveAction,
  testCourierAction,
} from "@/app/(dashboard)/couriers/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Messages } from "@/lib/i18n";

export type CourierAccountRow = {
  id: string;
  provider: string;
  label: string;
  is_active: boolean;
  last_tested_at: string | null;
  webhook_token: string | null;
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function CourierCard({
  couriers,
  account,
  providerLabel,
  webhookBaseUrl,
}: {
  couriers: Messages["couriers"];
  account: CourierAccountRow;
  providerLabel: string;
  webhookBaseUrl: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = account.webhook_token
    ? `${webhookBaseUrl}/api/webhooks/couriers/${account.provider}?token=${account.webhook_token}`
    : null;

  const run = async (action: () => Promise<{ error?: string; detail?: string }>, okText?: string) => {
    setPending(true);
    setMessage(null);
    const result = await action();
    setPending(false);

    if (result?.error) {
      setMessage({ tone: "error", text: result.error });
      return;
    }

    if (okText) setMessage({ tone: "info", text: result?.detail ? `${okText} ${result.detail}` : okText });
    router.refresh();
  };

  return (
    <article className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-brand-dark">{providerLabel}</h2>
            <Badge variant={account.is_active ? "success" : "neutral"}>
              {account.is_active ? couriers.status.active : couriers.status.inactive}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary">{account.label}</p>
          <p className="text-xs text-text-muted">
            {couriers.lastTested}:{" "}
            {account.last_tested_at
              ? dateTimeFormatter.format(new Date(account.last_tested_at))
              : couriers.never}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(() => testCourierAction(account.id), couriers.testOk)}
          >
            {pending ? couriers.testing : couriers.test}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setCourierActiveAction(account.id, !account.is_active))}
          >
            {account.is_active ? couriers.deactivate : couriers.activate}
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-tint">
                <Trash2 />
              </Button>
            </DialogTrigger>
            <DialogContent title={couriers.deleteConfirmTitle} description={couriers.deleteConfirmBody}>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => run(() => deleteCourierAction(account.id))}
                >
                  {couriers.deleteConfirm}
                </Button>
                <DialogClose asChild>
                  <Button variant="ghost">{couriers.cancel}</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {webhookUrl && (
        <div className="flex flex-col gap-2 rounded-lg bg-surface-alt p-4">
          <p className="font-display text-sm font-semibold text-brand-dark">{couriers.webhook.title}</p>
          <p className="text-sm text-text-secondary">{couriers.webhook.body}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md bg-surface px-3 py-2 text-xs text-text-primary">
              {webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(webhookUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? couriers.webhook.copied : couriers.webhook.copy}
            </Button>
          </div>
          <p className="text-xs text-text-muted">{couriers.webhook.keepSecret}</p>
        </div>
      )}

      {message && <FormNotice tone={message.tone}>{message.text}</FormNotice>}
    </article>
  );
}
