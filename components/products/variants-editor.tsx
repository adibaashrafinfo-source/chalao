"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import {
  adjustStockAction,
  createVariantAction,
  deleteVariantAction,
  updateVariantAction,
} from "@/app/(dashboard)/products/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT, formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { stockAdjustmentSchema, variantSchema, type StockAdjustmentValues, type VariantValues } from "@/lib/validations/product";

export type VariantRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  cost_price: number;
  selling_price: number;
};

export function VariantsEditor({
  products,
  productId,
  variants,
  lowStockThreshold,
}: {
  products: Messages["products"];
  productId: string;
  variants: VariantRow[];
  lowStockThreshold: number;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-base font-semibold text-brand-dark">{products.variants.title}</h2>
          <p className="text-sm text-text-secondary">{products.variants.subtitle}</p>
        </div>
        {!adding && (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus />
            {products.variants.add}
          </Button>
        )}
      </div>

      {variants.length === 0 && !adding && (
        <p className="rounded-lg bg-surface-alt px-4 py-6 text-center text-sm text-text-secondary">
          {products.variants.empty}
        </p>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border-subtle text-left text-xs tracking-wide text-text-muted">
                <th className="py-3 pr-4 font-medium">{products.variants.name}</th>
                <th className="py-3 pr-4 font-medium">{products.variants.sku}</th>
                <th className="py-3 pr-4 text-right font-medium">{products.variants.stock}</th>
                <th className="py-3 pr-4 text-right font-medium">{products.variants.costPrice}</th>
                <th className="py-3 pr-4 text-right font-medium">{products.variants.sellingPrice}</th>
                <th className="py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {variants.map((variant) =>
                editingId === variant.id ? (
                  <tr key={variant.id}>
                    <td colSpan={6} className="py-3">
                      <VariantForm
                        products={products}
                        productId={productId}
                        variant={variant}
                        onDone={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={variant.id} className="border-b border-border-subtle last:border-b-0">
                    <td className="py-3 pr-4 font-medium text-text-primary">{variant.name}</td>
                    <td className="py-3 pr-4 text-text-secondary">{variant.sku ?? "—"}</td>
                    <td className="py-3 pr-4 text-right">
                      <span className="inline-flex items-center gap-2">
                        {variant.stock < lowStockThreshold && (
                          <Badge variant="danger">{products.variants.lowStock}</Badge>
                        )}
                        <span className="tabular-nums">{formatCount(variant.stock)}</span>
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-text-secondary">
                      {formatBDT(variant.cost_price)}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-text-primary">
                      {formatBDT(variant.selling_price)}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        <AdjustStockDialog products={products} productId={productId} variant={variant} />
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${products.variants.edit} ${variant.name}`}
                          onClick={() => setEditingId(variant.id)}
                        >
                          <Pencil />
                        </Button>
                        <DeleteVariantButton products={products} productId={productId} variant={variant} />
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <VariantForm products={products} productId={productId} onDone={() => setAdding(false)} />
      )}
    </section>
  );
}

function VariantForm({
  products,
  productId,
  variant,
  onDone,
}: {
  products: Messages["products"];
  productId: string;
  variant?: VariantRow;
  onDone: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VariantValues>({
    resolver: zodResolver(variantSchema),
    defaultValues: variant
      ? {
          name: variant.name,
          sku: variant.sku ?? "",
          costPrice: Number(variant.cost_price),
          sellingPrice: Number(variant.selling_price),
          initialStock: 0,
        }
      : { name: "", sku: "", costPrice: 0, sellingPrice: 0, initialStock: 0 },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = variant
      ? await updateVariantAction(productId, variant.id, values)
      : await createVariantAction(productId, values);
    if (result?.error) setFormError(result.error);
    else onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-lg bg-surface-alt p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`v-name-${variant?.id ?? "new"}`}>{products.variants.name}</Label>
          <Input
            id={`v-name-${variant?.id ?? "new"}`}
            className="bg-surface"
            placeholder={products.variants.namePlaceholder}
            {...register("name")}
          />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`v-sku-${variant?.id ?? "new"}`}>{products.variants.sku}</Label>
          <Input id={`v-sku-${variant?.id ?? "new"}`} className="bg-surface" {...register("sku")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`v-cost-${variant?.id ?? "new"}`}>{products.variants.costPrice}</Label>
          <Input
            id={`v-cost-${variant?.id ?? "new"}`}
            type="number"
            min={0}
            step="0.01"
            className="bg-surface tabular-nums"
            {...register("costPrice")}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`v-price-${variant?.id ?? "new"}`}>{products.variants.sellingPrice}</Label>
          <Input
            id={`v-price-${variant?.id ?? "new"}`}
            type="number"
            min={0}
            step="0.01"
            className="bg-surface tabular-nums"
            {...register("sellingPrice")}
          />
        </div>
        {!variant && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-stock-new">{products.variants.initialStock}</Label>
            <Input
              id="v-stock-new"
              type="number"
              min={0}
              className="bg-surface tabular-nums"
              {...register("initialStock")}
            />
          </div>
        )}
      </div>

      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {products.variants.save}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {products.variants.cancel}
        </Button>
      </div>
    </form>
  );
}

function AdjustStockDialog({
  products,
  productId,
  variant,
}: {
  products: Messages["products"];
  productId: string;
  variant: VariantRow;
}) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StockAdjustmentValues>({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: { variantId: variant.id, newStock: variant.stock, note: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await adjustStockAction(productId, values);
    if (result?.error) {
      setFormError(result.error);
      return;
    }
    setOpen(false);
    reset({ variantId: variant.id, newStock: values.newStock as number, note: "" });
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${products.adjust.title} — ${variant.name}`}>
          <Scale />
        </Button>
      </DialogTrigger>
      <DialogContent title={products.adjust.title} description={products.adjust.description}>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <input type="hidden" {...register("variantId")} />
          <p className="rounded-lg bg-surface-alt px-4 py-3 text-sm text-text-secondary">
            {variant.name} · {products.adjust.current}:{" "}
            <span className="font-medium tabular-nums text-text-primary">{formatCount(variant.stock)}</span>
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`adjust-stock-${variant.id}`}>{products.adjust.newStock}</Label>
            <Input
              id={`adjust-stock-${variant.id}`}
              type="number"
              min={0}
              className="tabular-nums"
              {...register("newStock")}
            />
            {errors.newStock && <p className="text-xs text-danger">{errors.newStock.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor={`adjust-note-${variant.id}`}>{products.adjust.note}</Label>
            <Input
              id={`adjust-note-${variant.id}`}
              placeholder={products.adjust.notePlaceholder}
              {...register("note")}
            />
            {errors.note && <p className="text-xs text-danger">{errors.note.message}</p>}
          </div>

          {formError && <FormNotice tone="error">{formError}</FormNotice>}

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {products.adjust.submit}
            </Button>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {products.actions.cancel}
              </Button>
            </DialogClose>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteVariantButton({
  products,
  productId,
  variant,
}: {
  products: Messages["products"];
  productId: string;
  variant: VariantRow;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`${products.variants.remove} ${variant.name}`}>
          <Trash2 className="text-danger" />
        </Button>
      </DialogTrigger>
      <DialogContent title={`${products.variants.remove} — ${variant.name}`} description={products.actions.deleteConfirmBody}>
        {error && <FormNotice tone="error">{error}</FormNotice>}
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              const result = await deleteVariantAction(productId, variant.id);
              setPending(false);
              if (result?.error) setError(result.error);
              else {
                setOpen(false);
                router.refresh();
              }
            }}
          >
            {products.actions.deleteConfirm}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">{products.actions.cancel}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
