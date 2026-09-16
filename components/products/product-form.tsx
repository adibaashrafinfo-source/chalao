"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createProductAction, updateProductAction } from "@/app/(dashboard)/products/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { productSchema, type ProductValues } from "@/lib/validations/product";

export type ProductFormDefaults = {
  name: string;
  sku: string;
  category: string;
  description: string;
  lowStockThreshold: number;
  isActive: boolean;
};

export function ProductForm({
  products,
  productId,
  defaults,
}: {
  products: Messages["products"];
  productId?: string;
  defaults?: ProductFormDefaults;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductValues>({
    resolver: zodResolver(productSchema),
    defaultValues: defaults ?? {
      name: "",
      sku: "",
      category: "",
      description: "",
      lowStockThreshold: 5,
      isActive: true,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = productId
      ? await updateProductAction(productId, values)
      : await createProductAction(values);
    if (result?.error) setFormError(result.error);
    else if (productId) setSaved(true);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">{products.fields.name}</Label>
          <Input id="name" placeholder={products.fields.namePlaceholder} {...register("name")} />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="sku">
            {products.fields.sku}{" "}
            <span className="font-normal text-text-muted">({products.fields.optional})</span>
          </Label>
          <Input id="sku" placeholder={products.fields.skuPlaceholder} {...register("sku")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="category">
            {products.fields.category}{" "}
            <span className="font-normal text-text-muted">({products.fields.optional})</span>
          </Label>
          <Input id="category" placeholder={products.fields.categoryPlaceholder} {...register("category")} />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">
            {products.fields.description}{" "}
            <span className="font-normal text-text-muted">({products.fields.optional})</span>
          </Label>
          <textarea
            id="description"
            rows={3}
            className="w-full rounded-md border border-transparent bg-surface-alt px-4 py-3 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            {...register("description")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lowStockThreshold">{products.fields.lowStockThreshold}</Label>
          <Input
            id="lowStockThreshold"
            type="number"
            min={0}
            className="tabular-nums"
            {...register("lowStockThreshold")}
          />
        </div>

        <div className="flex items-end">
          <label className="flex h-10 items-center gap-3 text-sm text-text-primary">
            <input
              type="checkbox"
              className="size-4 rounded border-border-subtle accent-brand-lime"
              {...register("isActive")}
            />
            {products.fields.isActive}
          </label>
        </div>
      </div>

      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {productId ? products.actions.save : products.actions.create}
        </Button>
        {saved && <span className="text-sm text-success">Saved</span>}
      </div>
    </form>
  );
}
