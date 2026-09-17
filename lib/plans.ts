import "server-only";

import { unstable_cache } from "next/cache";
import { createClient as createPublicClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "@/lib/env";

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
 * Plans for the public pricing section. Read with a plain anon client so the marketing
 * pages stay static, and cached until an admin edits a price (revalidateTag).
 */
export const getPublicPlans = unstable_cache(
  async function loadPublicPlans(): Promise<PublicPlan[]> {
    const env = getSupabaseEnv();
    if (!env) return [];

    const supabase = createPublicClient(env.url, env.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
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
