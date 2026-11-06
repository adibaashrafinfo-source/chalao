import "server-only";

import { unstable_cache } from "next/cache";

import { hasDatabaseConfig } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/db/server";

export type PublicPlan = {
  code: string;
  name: string;
  tagline: string | null;
  monthly_price: number;
  order_limit: number | null;
  user_limit: number | null;
  is_featured: boolean;
  sort_order: number;
};

export const PLANS_TAG = "subscription-plans";

/**
 * Plans for the public pricing section. Read without a login so the marketing
 * pages stay static, and cached until an admin edits a price (revalidateTag).
 */
export const getPublicPlans = unstable_cache(
  async function loadPublicPlans(): Promise<PublicPlan[]> {
    if (!hasDatabaseConfig()) return [];

    const db = createAdminClient();

    const { data, error } = await db
      .from("subscription_plans")
      .select("code, name, tagline, monthly_price, order_limit, user_limit, is_featured, sort_order")
      .eq("is_active", true)
      .order("sort_order");

    if (error || !data) return [];
    return data as PublicPlan[];
  },
  ["subscription-plans"],
  { revalidate: 300, tags: [PLANS_TAG] },
);
