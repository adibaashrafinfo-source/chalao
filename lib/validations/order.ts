import { z } from "zod";

import { normalizeBdPhone } from "@/lib/phone";

export const orderSources = [
  "facebook",
  "instagram",
  "whatsapp",
  "website",
  "phone",
  "manual",
  "daraz",
  "other",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const money = z.coerce.number().min(0).max(99_999_999);

export const orderItemSchema = z.object({
  variantId: z.string().uuid("Pick a product"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(10_000),
  unitPrice: money,
});

export const newCustomerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .transform(normalizeBdPhone)
    .refine((value) => value.length >= 9 && value.length <= 15, "Enter a valid phone number"),
  address: optionalText(400),
  district: optionalText(60),
});

export const orderCreateSchema = z
  .object({
    customerId: z.string().uuid().nullable().optional(),
    newCustomer: newCustomerSchema.nullable().optional(),
    // Set when the order started from an inbox conversation, so the two stay linked.
    conversationId: z.string().uuid().nullable().optional(),
    items: z.array(orderItemSchema).min(1, "Add at least one product"),
    discount: money.default(0),
    deliveryCharge: money.default(0),
    source: z.enum(orderSources).default("manual"),
    deliveryAddress: optionalText(400),
    district: optionalText(60),
    notes: optionalText(1000),
  })
  .refine((value) => Boolean(value.customerId) || Boolean(value.newCustomer), {
    message: "Pick an existing customer or fill in the new customer details",
    path: ["customerId"],
  });

// Fields that stay editable while the order is still new or confirmed.
export const orderDetailsSchema = z.object({
  discount: money.default(0),
  deliveryCharge: money.default(0),
  source: z.enum(orderSources),
  deliveryAddress: optionalText(400),
  district: optionalText(60),
  notes: optionalText(1000),
});

export type OrderCreateValues = z.input<typeof orderCreateSchema>;
export type OrderDetailsValues = z.input<typeof orderDetailsSchema>;
export type OrderSource = (typeof orderSources)[number];
