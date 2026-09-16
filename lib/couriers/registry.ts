import { steadfastAdapter } from "@/lib/couriers/steadfast-adapter";
import type { CourierAdapter, CourierProvider } from "@/lib/couriers/types";

// The ONLY place allowed to branch on provider name (Brief §7). Everything else
// asks for an adapter and works against the interface.
const adapters: Record<CourierProvider, CourierAdapter> = {
  steadfast: steadfastAdapter,
};

export function getCourierAdapter(provider: string): CourierAdapter {
  const adapter = adapters[provider as CourierProvider];
  if (!adapter) throw new Error(`Unknown courier provider: ${provider}`);
  return adapter;
}

export function listCourierAdapters(): CourierAdapter[] {
  return Object.values(adapters);
}
