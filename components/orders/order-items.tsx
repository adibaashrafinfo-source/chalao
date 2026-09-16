"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { addOrderItemAction, removeOrderItemAction } from "@/app/(dashboard)/orders/actions";
import { FormNotice } from "@/components/auth/login-form";
import type { VariantOption } from "@/components/orders/order-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT, formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type OrderItemRow = {
  id: string;
  product_name: string;
  variant_name: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export function OrderItems({
  orders,
  orderId,
  items,
  variants,
  editable,
}: {
  orders: Messages["orders"];
  orderId: string;
  items: OrderItemRow[];
  variants: VariantOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onVariantChange = (id: string) => {
    setVariantId(id);
    const variant = variants.find((option) => option.id === id);
    setUnitPrice(variant ? String(variant.price) : "0");
  };

  const add = async () => {
    setPending(true);
    setError(null);
    const result = await addOrderItemAction(orderId, {
      variantId,
      quantity: Number(quantity) || 0,
      unitPrice: Number(unitPrice) || 0,
    });
    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setAdding(false);
    setVariantId("");
    setQuantity("1");
    setUnitPrice("0");
    router.refresh();
  };

  const remove = async (itemId: string) => {
    setPending(true);
    setError(null);
    const result = await removeOrderItemAction(orderId, itemId);
    setPending(false);
    if (result?.error) setError(result.error);
    else router.refresh();
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold text-brand-dark">{orders.items.title}</h2>
        {editable && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            {orders.items.add}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
              <th className="py-3 pr-4 font-medium">{orders.items.product}</th>
              <th className="py-3 pr-4 text-right font-medium">{orders.items.quantity}</th>
              <th className="py-3 pr-4 text-right font-medium">{orders.items.unitPrice}</th>
              <th className="py-3 pr-4 text-right font-medium">{orders.items.lineTotal}</th>
              {editable && <th className="py-3" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border-subtle last:border-b-0">
                <td className="py-3 pr-4">
                  <span className="font-medium text-text-primary">{item.product_name}</span>
                  {item.variant_name && <span className="text-text-secondary"> · {item.variant_name}</span>}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">{formatCount(item.quantity)}</td>
                <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">
                  {formatBDT(item.unit_price)}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums text-text-primary">{formatBDT(item.line_total)}</td>
                {editable && (
                  <td className="py-3 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`${orders.items.remove} ${item.product_name}`}
                      disabled={pending}
                      onClick={() => remove(item.id)}
                    >
                      <Trash2 className="text-danger" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <div className="grid gap-3 rounded-lg bg-surface-alt p-4 sm:grid-cols-[2fr_auto_auto_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-variant">{orders.items.product}</Label>
            <select
              id="add-variant"
              value={variantId}
              onChange={(event) => onVariantChange(event.target.value)}
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
            <Label htmlFor="add-qty">{orders.items.quantity}</Label>
            <Input
              id="add-qty"
              type="number"
              min={1}
              className="bg-surface tabular-nums"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-32">
            <Label htmlFor="add-price">{orders.items.unitPrice}</Label>
            <Input
              id="add-price"
              type="number"
              min={0}
              step="0.01"
              className="bg-surface tabular-nums"
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={pending || !variantId} onClick={add}>
              {orders.items.add}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              {orders.actions.cancel}
            </Button>
          </div>
        </div>
      )}

      {!editable && <p className="text-xs text-text-secondary">{orders.items.lockedNew}</p>}
      {error && <FormNotice tone="error">{error}</FormNotice>}
    </section>
  );
}
