"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";
import { normalizeBdPhone } from "@/lib/phone";

/**
 * Confirming by phone is what sellers here actually do, and most of it happens
 * on WhatsApp. This needs no integration and no approval: a wa.me link opens
 * WhatsApp with the message already written, and the seller presses send.
 *
 * The message is in Bangla because the person receiving it is a customer, not
 * a seller — the rest of this dashboard is English for the seller's benefit.
 */
export function WhatsAppButton({
  copy,
  phone,
  orderNumber,
  total,
  items,
  address,
}: {
  copy: Messages["orders"]["whatsapp"];
  phone: string;
  orderNumber: number;
  total: number;
  items: { product_name: string; variant_name: string | null; quantity: number }[];
  address: string;
}) {
  // wa.me wants the full international number with no symbols: 8801XXXXXXXXX.
  const local = normalizeBdPhone(phone);
  if (!local) return null;
  const international = local.startsWith("880") ? local : `880${local.replace(/^0/, "")}`;

  const lines = items
    .map((item) => `• ${item.product_name}${item.variant_name ? ` (${item.variant_name})` : ""} × ${item.quantity}`)
    .join("\n");

  const message = [
    copy.greeting,
    "",
    `${copy.orderNumber}: #${orderNumber}`,
    lines,
    `${copy.total}: ${formatBDT(total)}`,
    address ? `${copy.address}: ${address}` : "",
    "",
    copy.question,
  ]
    .filter(Boolean)
    .join("\n");

  const href = `https://wa.me/${international}?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild variant="outline" size="sm">
      <a href={href} target="_blank" rel="noreferrer noopener">
        <MessageCircle className="size-4" aria-hidden="true" />
        {copy.send}
      </a>
    </Button>
  );
}
