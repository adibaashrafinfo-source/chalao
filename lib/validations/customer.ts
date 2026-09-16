import { z } from "zod";

import { normalizeBdPhone } from "@/lib/phone";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const phone = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform(normalizeBdPhone)
  .refine((value) => value.length >= 9 && value.length <= 15, "Enter a valid phone number");

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(120),
  phone,
  altPhone: optionalText(20),
  email: optionalText(160),
  address: optionalText(400),
  district: optionalText(60),
  notes: optionalText(1000),
});

export type CustomerValues = z.input<typeof customerSchema>;
