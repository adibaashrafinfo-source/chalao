import { mockChannelAdapter } from "@/lib/channels/mock-adapter";
import type { ChannelAdapter, ChannelProvider } from "@/lib/channels/types";

// The ONLY place allowed to branch on channel provider. Everything else asks for
// an adapter and works against the interface.
//
// Facebook and Instagram are deliberately absent rather than stubbed: an adapter
// that cannot really send a message would make the inbox look finished when it
// is not. They join this map when the Meta app is approved and the page tokens
// exist; nothing else has to change.
const adapters: Partial<Record<ChannelProvider, ChannelAdapter>> = {
  mock: mockChannelAdapter,
};

export function getChannelAdapter(provider: string): ChannelAdapter {
  const adapter = adapters[provider as ChannelProvider];
  if (!adapter) throw new Error(`Unknown channel provider: ${provider}`);
  return adapter;
}

export function findChannelAdapter(provider: string): ChannelAdapter | null {
  return adapters[provider as ChannelProvider] ?? null;
}

export function listChannelAdapters(): ChannelAdapter[] {
  return Object.values(adapters).filter((adapter): adapter is ChannelAdapter => Boolean(adapter));
}
