import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const money = z.coerce.number().min(0).max(99_999_999);

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(120),
  sku: optionalText(60),
  category: optionalText(60),
  description: optionalText(2000),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).default(5),
  isActive: z.boolean().default(true),
});

export const variantSchema = z.object({
  name: z.string().trim().min(1, "Variant name is required").max(60),
  sku: optionalText(60),
  costPrice: money.default(0),
  sellingPrice: money.default(0),
  // Only used when creating; stock afterwards moves through apply_inventory_movement().
  initialStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const stockAdjustmentSchema = z.object({
  variantId: z.string().uuid(),
  newStock: z.coerce.number().int().min(0).max(1_000_000),
  note: z.string().trim().min(3, "Please write a short reason").max(300),
});

export type ProductValues = z.input<typeof productSchema>;
export type VariantValues = z.input<typeof variantSchema>;
export type StockAdjustmentValues = z.input<typeof stockAdjustmentSchema>;
