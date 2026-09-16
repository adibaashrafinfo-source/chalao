"use client";

import { useState } from "react";

import { updateOrderDetailsAction } from "@/app/(dashboard)/orders/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { orderSources } from "@/lib/validations/order";

export function OrderDetailsForm({
  orders,
  orderId,
  subtotal,
  defaults,
}: {
  orders: Messages["orders"];
  orderId: string;
  subtotal: number;
  defaults: {
    discount: number;
    deliveryCharge: number;
    source: string;
    deliveryAddress: string;
    district: string;
    notes: string;
  };
}) {
  const [discount, setDiscount] = useState(String(defaults.discount));
  const [deliveryCharge, setDeliveryCharge] = useState(String(defaults.deliveryCharge));
  const [source, setSource] = useState(defaults.source);
  const [deliveryAddress, setDeliveryAddress] = useState(defaults.deliveryAddress);
  const [district, setDistrict] = useState(defaults.district);
  const [notes, setNotes] = useState(defaults.notes);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(deliveryCharge) || 0));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updateOrderDetailsAction(orderId, {
      discount: Number(discount) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      source,
      deliveryAddress,
      district,
      notes,
    });

    setPending(false);
    if (result?.error) setError(result.error);
    else setSaved(true);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <h2 className="font-display text-base font-semibold text-brand-dark">{orders.charges.title}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="discount">{orders.charges.discount}</Label>
          <Input
            id="discount"
            type="number"
            min={0}
            step="0.01"
            className="tabular-nums"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="deliveryCharge">{orders.charges.deliveryCharge}</Label>
          <Input
            id="deliveryCharge"
            type="number"
            min={0}
            step="0.01"
            className="tabular-nums"
            value={deliveryCharge}
            onChange={(event) => setDeliveryCharge(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">{orders.charges.source}</Label>
          <select
            id="source"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
          >
            {orderSources.map((value) => (
              <option key={value} value={value}>
                {orders.sources[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="deliveryAddress">{orders.charges.deliveryAddress}</Label>
          <Input
            id="deliveryAddress"
            value={deliveryAddress}
            onChange={(event) => setDeliveryAddress(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="district">{orders.charges.district}</Label>
          <Input id="district" value={district} onChange={(event) => setDistrict(event.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-3">
          <Label htmlFor="notes">{orders.charges.notes}</Label>
          <textarea
            id="notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-md border border-transparent bg-surface-alt px-4 py-3 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
          />
        </div>
      </div>

      <dl className="flex flex-col gap-2 border-t border-border-subtle pt-4 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-text-secondary">{orders.charges.subtotal}</dt>
          <dd className="tabular-nums">{formatBDT(subtotal)}</dd>
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle pt-2">
          <dt className="font-display font-semibold text-brand-dark">{orders.charges.total}</dt>
          <dd className="font-display text-lg font-bold tabular-nums text-brand-dark">{formatBDT(total)}</dd>
        </div>
      </dl>

      {error && <FormNotice tone="error">{error}</FormNotice>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {orders.actions.save}
        </Button>
        {saved && <span className="text-sm text-success">{orders.actions.saved}</span>}
      </div>
    </form>
  );
}
