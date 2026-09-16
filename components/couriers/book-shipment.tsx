"use client";

import { Truck } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { bookShipmentAction } from "@/app/(dashboard)/couriers/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type CourierChoice = { id: string; label: string; providerLabel: string };

export function BookShipment({
  couriers,
  orderId,
  courierAccounts,
  defaults,
}: {
  couriers: Messages["couriers"];
  orderId: string;
  courierAccounts: CourierChoice[];
  defaults: {
    recipientName: string;
    recipientPhone: string;
    recipientAddress: string;
    district: string;
    codAmount: number;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courierAccountId, setCourierAccountId] = useState(courierAccounts[0]?.id ?? "");
  const [recipientName, setRecipientName] = useState(defaults.recipientName);
  const [recipientPhone, setRecipientPhone] = useState(defaults.recipientPhone);
  const [recipientAddress, setRecipientAddress] = useState(defaults.recipientAddress);
  const [district, setDistrict] = useState(defaults.district);
  const [codAmount, setCodAmount] = useState(String(defaults.codAmount));
  const [weight, setWeight] = useState("500");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (courierAccounts.length === 0) {
    return <FormNotice tone="error">{couriers.errors.noActiveCourier}</FormNotice>;
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await bookShipmentAction({
      orderId,
      courierAccountId,
      recipientName,
      recipientPhone,
      recipientAddress,
      district,
      codAmount: Number(codAmount) || 0,
      weightGrams: Number(weight) || undefined,
      note,
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Truck />
          {couriers.booking.button}
        </Button>
      </DialogTrigger>
      <DialogContent title={couriers.booking.title} description={couriers.booking.description}>
        <form onSubmit={submit} className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          {courierAccounts.length > 1 && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="courier-account">{couriers.booking.courier}</Label>
              <select
                id="courier-account"
                value={courierAccountId}
                onChange={(event) => setCourierAccountId(event.target.value)}
                className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
              >
                {courierAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.providerLabel} · {account.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="recipient-name">{couriers.booking.recipientName}</Label>
            <Input
              id="recipient-name"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recipient-phone">{couriers.booking.recipientPhone}</Label>
            <Input
              id="recipient-phone"
              inputMode="tel"
              className="tabular-nums"
              value={recipientPhone}
              onChange={(event) => setRecipientPhone(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="recipient-address">{couriers.booking.recipientAddress}</Label>
            <Input
              id="recipient-address"
              value={recipientAddress}
              onChange={(event) => setRecipientAddress(event.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="district">{couriers.booking.district}</Label>
              <Input id="district" value={district} onChange={(event) => setDistrict(event.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">{couriers.booking.weight}</Label>
              <Input
                id="weight"
                type="number"
                min={1}
                className="tabular-nums"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="cod-amount">{couriers.booking.codAmount}</Label>
            <Input
              id="cod-amount"
              type="number"
              min={0}
              step="0.01"
              className="tabular-nums"
              value={codAmount}
              onChange={(event) => setCodAmount(event.target.value)}
            />
            <p className="text-xs text-text-muted">
              {couriers.booking.codHint} · {formatBDT(Number(codAmount) || 0)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="courier-note">{couriers.booking.note}</Label>
            <Input id="courier-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          {error && <FormNotice tone="error">{error}</FormNotice>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? couriers.booking.booking : couriers.booking.submit}
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
