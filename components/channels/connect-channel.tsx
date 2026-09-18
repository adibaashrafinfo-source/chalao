"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { createChannelAction } from "@/app/(dashboard)/settings/channels/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialField } from "@/lib/channels/types";
import type { Messages } from "@/lib/i18n";

export function ConnectChannel({
  channels,
  providers,
}: {
  channels: Messages["channels"];
  providers: { provider: string; label: string; description: string; credentialFields: CredentialField[] }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(providers[0]?.provider ?? "mock");
  const [label, setLabel] = useState(providers[0]?.label ?? "Sandbox");
  const [externalId, setExternalId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = providers.find((entry) => entry.provider === provider) ?? providers[0];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createChannelAction({ provider, label, externalId });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setExternalId("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {channels.connect}
        </Button>
      </DialogTrigger>
      <DialogContent title={channels.connectTitle} description={channels.connectDescription}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-provider">{channels.provider}</Label>
            <select
              id="channel-provider"
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value);
                const next = providers.find((entry) => entry.provider === event.target.value);
                if (next) setLabel(next.label);
              }}
              className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            >
              {providers.map((entry) => (
                <option key={entry.provider} value={entry.provider}>
                  {entry.label}
                </option>
              ))}
            </select>
            {selected ? <p className="text-xs text-text-muted">{selected.description}</p> : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-label">{channels.label}</Label>
            <Input id="channel-label" value={label} onChange={(event) => setLabel(event.target.value)} />
            <p className="text-xs text-text-muted">{channels.labelHelp}</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="channel-external-id">{channels.externalId}</Label>
            <Input
              id="channel-external-id"
              value={externalId}
              onChange={(event) => setExternalId(event.target.value)}
              placeholder="—"
            />
            <p className="text-xs text-text-muted">{channels.externalIdHelp}</p>
          </div>

          {error ? <FormNotice tone="error">{error}</FormNotice> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {channels.cancel}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? channels.saving : channels.save}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
