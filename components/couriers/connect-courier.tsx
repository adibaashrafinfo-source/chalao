"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { connectCourierAction } from "@/app/(dashboard)/couriers/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CredentialField } from "@/lib/couriers/types";
import type { Messages } from "@/lib/i18n";

export function ConnectCourier({
  couriers,
  providers,
  canManage,
}: {
  couriers: Messages["couriers"];
  providers: { provider: string; label: string; credentialFields: CredentialField[] }[];
  /** Staff work with the couriers that are connected, but do not change them. */
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState(providers[0]?.provider ?? "steadfast");
  const [label, setLabel] = useState("Default");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selected = providers.find((entry) => entry.provider === provider) ?? providers[0];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await connectCourierAction({ provider, label, credentials });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setCredentials({});
    router.refresh();
  };

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {couriers.connect}
        </Button>
      </DialogTrigger>
      <DialogContent title={couriers.connectTitle} description={couriers.connectDescription}>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider">{couriers.provider}</Label>
            <select
              id="provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            >
              {providers.map((entry) => (
                <option key={entry.provider} value={entry.provider}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="label">{couriers.label}</Label>
            <Input id="label" value={label} onChange={(event) => setLabel(event.target.value)} />
            <p className="text-xs text-text-muted">{couriers.labelHelp}</p>
          </div>

          {selected?.credentialFields.map((field) => (
            <div key={field.key} className="flex flex-col gap-2">
              <Label htmlFor={`cred-${field.key}`}>{field.label}</Label>
              <Input
                id={`cred-${field.key}`}
                type="password"
                autoComplete="off"
                value={credentials[field.key] ?? ""}
                onChange={(event) =>
                  setCredentials((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
              {field.help && <p className="text-xs text-text-muted">{field.help}</p>}
            </div>
          ))}

          {error && <FormNotice tone="error">{error}</FormNotice>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? couriers.testing : couriers.save}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {couriers.cancel}
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
