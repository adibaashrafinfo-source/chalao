"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { createCustomerAction, updateCustomerAction } from "@/app/(dashboard)/customers/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import { customerSchema, type CustomerValues } from "@/lib/validations/customer";

export type CustomerFormDefaults = {
  name: string;
  phone: string;
  altPhone: string;
  email: string;
  address: string;
  district: string;
  notes: string;
};

export function CustomerForm({
  customers,
  customerId,
  defaults,
}: {
  customers: Messages["customers"];
  customerId?: string;
  defaults?: CustomerFormDefaults;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues:
      defaults ?? { name: "", phone: "", altPhone: "", email: "", address: "", district: "", notes: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setSaved(false);
    const result = customerId
      ? await updateCustomerAction(customerId, values)
      : await createCustomerAction(values);
    if (result?.error) setFormError(result.error);
    else if (customerId) setSaved(true);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{customers.fields.name}</Label>
          <Input id="name" placeholder={customers.fields.namePlaceholder} {...register("name")} />
          {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{customers.fields.phone}</Label>
          <Input
            id="phone"
            inputMode="tel"
            className="tabular-nums"
            placeholder={customers.fields.phonePlaceholder}
            {...register("phone")}
          />
          {errors.phone && <p className="text-xs text-danger">{errors.phone.message}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="altPhone">
            {customers.fields.altPhone}{" "}
            <span className="font-normal text-text-muted">({customers.fields.optional})</span>
          </Label>
          <Input id="altPhone" inputMode="tel" className="tabular-nums" {...register("altPhone")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">
            {customers.fields.email}{" "}
            <span className="font-normal text-text-muted">({customers.fields.optional})</span>
          </Label>
          <Input id="email" type="email" {...register("email")} />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="address">
            {customers.fields.address}{" "}
            <span className="font-normal text-text-muted">({customers.fields.optional})</span>
          </Label>
          <Input id="address" {...register("address")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="district">
            {customers.fields.district}{" "}
            <span className="font-normal text-text-muted">({customers.fields.optional})</span>
          </Label>
          <Input id="district" {...register("district")} />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="notes">
            {customers.fields.notes}{" "}
            <span className="font-normal text-text-muted">({customers.fields.optional})</span>
          </Label>
          <textarea
            id="notes"
            rows={3}
            className="w-full rounded-md border border-transparent bg-surface-alt px-4 py-3 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30"
            {...register("notes")}
          />
        </div>
      </div>

      {formError && <FormNotice tone="error">{formError}</FormNotice>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {customerId ? customers.actions.save : customers.actions.create}
        </Button>
        {saved && <span className="text-sm text-success">{customers.actions.saved}</span>}
      </div>
    </form>
  );
}
