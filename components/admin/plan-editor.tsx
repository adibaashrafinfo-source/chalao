"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { updatePlanAction } from "@/app/(dashboard)/admin/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT, formatCount } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

export type EditablePlan = {
  code: string;
  name: string;
  tagline: string | null;
  monthly_price: number;
  order_limit: number | null;
  user_limit: number | null;
  is_featured: boolean;
  is_active: boolean;
  subscribers: number;
};

export function PlanEditor({ copy, plan }: { copy: Messages["admin"]["plans"]; plan: EditablePlan }) {
  const router = useRouter();

  const [name, setName] = useState(plan.name);
  const [tagline, setTagline] = useState(plan.tagline ?? "");
  const [price, setPrice] = useState(String(plan.monthly_price));
  const [orderLimit, setOrderLimit] = useState(plan.order_limit === null ? "" : String(plan.order_limit));
  const [userLimit, setUserLimit] = useState(plan.user_limit === null ? "" : String(plan.user_limit));
  const [isFeatured, setIsFeatured] = useState(plan.is_featured);
  const [isActive, setIsActive] = useState(plan.is_active);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await updatePlanAction({
      code: plan.code,
      name,
      tagline,
      monthlyPrice: Number(price) || 0,
      orderLimit: orderLimit === "" ? "" : Number(orderLimit),
      userLimit: userLimit === "" ? "" : Number(userLimit),
      isFeatured,
      isActive,
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setSaved(true);
    router.refresh();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-brand-dark">
          {plan.name}
          <span className="ml-2 font-sans text-sm font-normal text-text-secondary">
            {formatBDT(plan.monthly_price)}
          </span>
        </h2>
        <span className="rounded-full bg-surface-alt px-3 py-1 text-xs text-text-secondary">
          {copy.businessesOnPlan.replace("{count}", formatCount(plan.subscribers))}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`name-${plan.code}`}>{copy.columns.plan}</Label>
          <Input id={`name-${plan.code}`} value={name} onChange={(event) => setName(event.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5 lg:col-span-3">
          <Label htmlFor={`tagline-${plan.code}`}>{copy.columns.tagline}</Label>
          <Input
            id={`tagline-${plan.code}`}
            value={tagline}
            onChange={(event) => setTagline(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`price-${plan.code}`}>{copy.columns.price}</Label>
          <Input
            id={`price-${plan.code}`}
            type="number"
            min={0}
            step="1"
            className="tabular-nums"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`orders-${plan.code}`}>{copy.columns.orders}</Label>
          <Input
            id={`orders-${plan.code}`}
            type="number"
            min={0}
            className="tabular-nums"
            placeholder={copy.unlimitedHint}
            value={orderLimit}
            onChange={(event) => setOrderLimit(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`users-${plan.code}`}>{copy.columns.users}</Label>
          <Input
            id={`users-${plan.code}`}
            type="number"
            min={1}
            className="tabular-nums"
            placeholder={copy.unlimitedHint}
            value={userLimit}
            onChange={(event) => setUserLimit(event.target.value)}
          />
        </div>

        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              className="size-4 rounded border-border-subtle accent-brand-lime"
              checked={isFeatured}
              onChange={(event) => setIsFeatured(event.target.checked)}
            />
            {copy.columns.featured}
          </label>
          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              className="size-4 rounded border-border-subtle accent-brand-lime"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />
            {copy.columns.active}
          </label>
        </div>
      </div>

      {error && <FormNotice tone="error">{error}</FormNotice>}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="outline" disabled={pending}>
          {copy.save}
        </Button>
        {saved && <span className="text-sm text-success">{copy.saved}</span>}
      </div>
    </form>
  );
}
