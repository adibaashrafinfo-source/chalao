"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { createOrderAction } from "@/app/(dashboard)/orders/actions";
import type { CustomerMatch } from "@/app/(dashboard)/customers/actions";
import { FormNotice } from "@/components/auth/login-form";
import { CustomerPicker, type NewCustomerDraft } from "@/components/orders/customer-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT, formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { orderSources } from "@/lib/validations/order";

export type VariantOption = {
  id: string;
  productName: string;
  variantName: string;
  sku: string | null;
  price: number;
  stock: number;
};

type ItemDraft = { key: string; variantId: string; quantity: string; unitPrice: string };

const newItem = (): ItemDraft => ({
  key: Math.random().toString(36).slice(2),
  variantId: "",
  quantity: "1",
  unitPrice: "0",
});

export function OrderForm({
  orders,
  variants,
  presetCustomer = null,
  conversationId = null,
  presetSource,
}: {
  orders: Messages["orders"];
  variants: VariantOption[];
  /** Filled in when the order started from a conversation in the inbox. */
  presetCustomer?: CustomerMatch | null;
  conversationId?: string | null;
  presetSource?: string;
}) {
  const [customer, setCustomer] = useState<CustomerMatch | null>(presetCustomer);
  const [draft, setDraft] = useState<NewCustomerDraft>({ name: "", phone: "", address: "", district: "" });
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [discount, setDiscount] = useState("0");
  const [deliveryCharge, setDeliveryCharge] = useState("0");
  const [source, setSource] = useState<string>(presetSource ?? "facebook");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0),
    0,
  );
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(deliveryCharge) || 0));

  const updateItem = (key: string, patch: Partial<ItemDraft>) => {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const onVariantChange = (key: string, variantId: string) => {
    const variant = variants.find((option) => option.id === variantId);
    updateItem(key, { variantId, unitPrice: variant ? String(variant.price) : "0" });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setPending(true);

    const result = await createOrderAction({
      customerId: customer?.id ?? null,
      conversationId,
      newCustomer: customer
        ? null
        : {
            name: draft.name,
            phone: draft.phone,
            address: draft.address,
            district: draft.district,
          },
      items: items
        .filter((item) => item.variantId)
        .map((item) => ({
          variantId: item.variantId,
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0,
        })),
      discount: Number(discount) || 0,
      deliveryCharge: Number(deliveryCharge) || 0,
      source,
      deliveryAddress: deliveryAddress || (customer ? customer.address ?? "" : draft.address),
      district: district || (customer ? customer.district ?? "" : draft.district),
      notes,
    });

    setPending(false);
    if (result?.error) setFormError(result.error);
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <CustomerPicker
        orders={orders}
        selected={customer}
        onSelect={setCustomer}
        draft={draft}
        onDraftChange={setDraft}
      />

      {/* ---- products ---- */}
      <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-brand-dark">{orders.items.title}</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setItems((c) => [...c, newItem()])}>
            <Plus />
            {orders.items.add}
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const variant = variants.find((option) => option.id === item.variantId);
            const lineTotal = (Number(item.unitPrice) || 0) * (Number(item.quantity) || 0);

            return (
              <div key={item.key} className="grid gap-3 rounded-lg bg-surface-alt p-4 sm:grid-cols-[2fr_auto_auto_auto_auto] sm:items-end">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`variant-${item.key}`}>{orders.items.product}</Label>
                  <select
                    id={`variant-${item.key}`}
                    value={item.variantId}
                    onChange={(event) => onVariantChange(item.key, event.target.value)}
                    className="h-10 rounded-md border border-transparent bg-surface px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
                  >
                    <option value="">{orders.items.selectProduct}</option>
                    {variants.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.productName} · {option.variantName} ({formatCount(option.stock)} {orders.items.stockLeft})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-24">
                  <Label htmlFor={`qty-${item.key}`}>{orders.items.quantity}</Label>
                  <Input
                    id={`qty-${item.key}`}
                    type="number"
                    min={1}
                    className="bg-surface tabular-nums"
                    value={item.quantity}
                    onChange={(event) => updateItem(item.key, { quantity: event.target.value })}
                  />
                </div>

                <div className="flex w-full flex-col gap-1.5 sm:w-32">
                  <Label htmlFor={`price-${item.key}`}>{orders.items.unitPrice}</Label>
                  <Input
                    id={`price-${item.key}`}
                    type="number"
                    min={0}
                    step="0.01"
                    className="bg-surface tabular-nums"
                    value={item.unitPrice}
                    onChange={(event) => updateItem(item.key, { unitPrice: event.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5 sm:w-28">
                  <span className="text-sm font-medium text-text-primary">{orders.items.lineTotal}</span>
                  <span className="flex h-10 items-center tabular-nums text-text-primary">{formatBDT(lineTotal)}</span>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={orders.items.remove}
                  disabled={items.length === 1}
                  onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                >
                  <Trash2 className="text-danger" />
                </Button>

                {variant && variant.stock < (Number(item.quantity) || 0) && (
                  <p className="text-xs text-warning sm:col-span-5">
                    {variant.productName} · {variant.variantName}: {formatCount(variant.stock)} {orders.items.stockLeft}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- charges ---- */}
      <section className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
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
            <Label htmlFor="deliveryAddress">
              {orders.charges.deliveryAddress}{" "}
              <span className="font-normal text-text-muted">({orders.charges.optional})</span>
            </Label>
            <Input
              id="deliveryAddress"
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="district">
              {orders.charges.district}{" "}
              <span className="font-normal text-text-muted">({orders.charges.optional})</span>
            </Label>
            <Input id="district" value={district} onChange={(event) => setDistrict(event.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <Label htmlFor="notes">
              {orders.charges.notes} <span className="font-normal text-text-muted">({orders.charges.optional})</span>
            </Label>
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
          <div className="flex items-center justify-between">
            <dt className="text-text-secondary">{orders.charges.discount}</dt>
            <dd className="tabular-nums">−{formatBDT(Number(discount) || 0)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-secondary">{orders.charges.deliveryCharge}</dt>
            <dd className="tabular-nums">{formatBDT(Number(deliveryCharge) || 0)}</dd>
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle pt-2">
            <dt className="font-display font-semibold text-brand-dark">{orders.charges.total}</dt>
            <dd className="font-display text-lg font-bold tabular-nums text-brand-dark">{formatBDT(total)}</dd>
          </div>
        </dl>
      </section>

      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {orders.actions.create}
        </Button>
      </div>
    </form>
  );
}
