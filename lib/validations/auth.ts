import { z } from "zod";

import type { Messages } from "@/lib/i18n";

// Shared by the client forms and (from step 3) the server actions. Error text comes from the dictionary.
type V = Messages["validation"];

export const makeLoginSchema = (v: V) =>
  z.object({
    email: z.string().trim().min(1, v.required).pipe(z.email(v.email)),
    password: z.string().min(1, v.required),
  });

export const makeSignupSchema = (v: V) =>
  z.object({
    fullName: z.string().trim().min(1, v.required).max(120),
    email: z.string().trim().min(1, v.required).pipe(z.email(v.email)),
    password: z.string().min(8, v.passwordMin).max(72),
  });

export type LoginValues = z.infer<ReturnType<typeof makeLoginSchema>>;
export type SignupValues = z.infer<ReturnType<typeof makeSignupSchema>>;
