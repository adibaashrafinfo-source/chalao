"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { recordPayoutAction } from "@/app/(dashboard)/cod/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UnsettledShipment } from "@/lib/cod/types";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

type Line = { deliveryCharge: string; codFee: string; adjustment: string };

const emptyLine = (): Line => ({ deliveryCharge: "0", codFee: "0", adjustment: "0" });

const selectClass =
  "h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30";

export function RecordPayout({
  copy,
  shipments,
  couriers,
}: {
  copy: Messages["cod"];
  shipments: UnsettledShipment[];
  couriers: { id: string; label: string; provider: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [courierId, setCourierId] = useState(couriers[0]?.id ?? "");
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountReceived, setAmountReceived] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [lines, setLines] = useState<Record<string, Line>>({});
  const [bulk, setBulk] = useState<Line>(emptyLine());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const lineFor = (id: string) => lines[id] ?? emptyLine();

  const selected = shipments.filter((shipment) => ticked[shipment.shipmentId]);

  const totals = useMemo(() => {
    let cod = 0;
    let charges = 0;
    for (const shipment of selected) {
      const line = lineFor(shipment.shipmentId);
      cod += shipment.codAmount;
      charges +=
        (Number(line.deliveryCharge) || 0) + (Number(line.codFee) || 0) - (Number(line.adjustment) || 0);
    }
    const expected = cod - charges;
    return { cod, charges, expected, difference: (Number(amountReceived) || 0) - expected };
  }, [selected, lines, amountReceived]);

  const applyToAll = () => {
    setLines((current) => {
      const next = { ...current };
      for (const shipment of selected) next[shipment.shipmentId] = { ...bulk };
      return next;
    });
  };

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    if (value) for (const shipment of shipments) next[shipment.shipmentId] = true;
    setTicked(next);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    const courier = couriers.find((entry) => entry.id === courierId);

    const result = await recordPayoutAction({
      courierAccountId: courier?.id ?? null,
      provider: courier?.provider ?? selected[0]?.provider ?? "steadfast",
      paidOn,
      amountReceived: Number(amountReceived) || 0,
      method,
      reference: reference.trim() || null,
      note: note.trim() || null,
      lines: selected.map((shipment) => {
        const line = lineFor(shipment.shipmentId);
        return {
          shipmentId: shipment.shipmentId,
          deliveryCharge: Number(line.deliveryCharge) || 0,
          codFee: Number(line.codFee) || 0,
          adjustment: Number(line.adjustment) || 0,
        };
      }),
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    setTicked({});
    setLines({});
    setAmountReceived("");
    setReference("");
    setNote("");
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={shipments.length === 0}>
          <Plus />
          {copy.payouts.record}
        </Button>
      </DialogTrigger>
      <DialogContent title={copy.form.title} description={copy.form.description}>
        {shipments.length === 0 ? (
          <p className="text-sm text-text-secondary">{copy.form.nothingToSettle}</p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payout-courier">{copy.form.courier}</Label>
                <select
                  id="payout-courier"
                  value={courierId}
                  onChange={(event) => setCourierId(event.target.value)}
                  className={selectClass}
                >
                  {couriers.length === 0 ? <option value="">{copy.form.noCourier}</option> : null}
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payout-date">{copy.form.paidOn}</Label>
                <Input
                  id="payout-date"
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payout-amount">{copy.form.amountReceived}</Label>
                <Input
                  id="payout-amount"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={amountReceived}
                  onChange={(event) => setAmountReceived(event.target.value)}
                />
                <p className="text-xs text-text-muted">{copy.form.amountHint}</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="payout-method">{copy.form.method}</Label>
                <select
                  id="payout-method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className={selectClass}
                >
                  {(["bank", "bkash", "nagad", "cash", "other"] as const).map((value) => (
                    <option key={value} value={value}>
                      {copy.methods[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payout-reference">{copy.form.reference}</Label>
              <Input
                id="payout-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
              <p className="text-xs text-text-muted">{copy.form.referenceHint}</p>
            </div>

            {/* ---- the charges most couriers apply to every parcel the same way */}
            <div className="flex flex-col gap-2 rounded-lg bg-surface-alt p-4">
              <p className="text-xs font-medium text-text-secondary">{copy.form.applyToAll}</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex w-28 flex-col gap-1">
                  <Label htmlFor="bulk-delivery" className="text-xs">
                    {copy.form.deliveryCharge}
                  </Label>
                  <Input
                    id="bulk-delivery"
                    type="number"
                    min={0}
                    value={bulk.deliveryCharge}
                    onChange={(event) => setBulk({ ...bulk, deliveryCharge: event.target.value })}
                  />
                </div>
                <div className="flex w-28 flex-col gap-1">
                  <Label htmlFor="bulk-fee" className="text-xs">
                    {copy.form.codFee}
                  </Label>
                  <Input
                    id="bulk-fee"
                    type="number"
                    min={0}
                    value={bulk.codFee}
                    onChange={(event) => setBulk({ ...bulk, codFee: event.target.value })}
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={applyToAll}>
                  {copy.form.apply}
                </Button>
              </div>
            </div>

            {/* ---- the parcels */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-brand-dark">
                {copy.form.selected.replace("{count}", String(selected.length))}
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setAll(true)}>
                  {copy.form.selectAll}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setAll(false)}>
                  {copy.form.clearAll}
                </Button>
              </div>
            </div>

            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {shipments.map((shipment) => {
                const line = lineFor(shipment.shipmentId);
                const isTicked = Boolean(ticked[shipment.shipmentId]);
                return (
                  <div
                    key={shipment.shipmentId}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-alt px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={isTicked}
                      aria-label={`#${shipment.orderNumber} ${shipment.recipientName}`}
                      onChange={(event) =>
                        setTicked({ ...ticked, [shipment.shipmentId]: event.target.checked })
                      }
                      className="size-4 shrink-0 accent-brand-dark"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-brand-dark">
                        #{shipment.orderNumber} · {shipment.recipientName}
                      </span>
                      <span className="text-xs text-text-muted">
                        {shipment.district ?? "—"} · {formatBDT(shipment.codAmount)}
                      </span>
                    </span>
                    {isTicked ? (
                      <span className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          aria-label={`${copy.form.deliveryCharge} #${shipment.orderNumber}`}
                          value={line.deliveryCharge}
                          onChange={(event) =>
                            setLines({
                              ...lines,
                              [shipment.shipmentId]: { ...line, deliveryCharge: event.target.value },
                            })
                          }
                          className="h-9 w-20"
                        />
                        <Input
                          type="number"
                          min={0}
                          aria-label={`${copy.form.codFee} #${shipment.orderNumber}`}
                          value={line.codFee}
                          onChange={(event) =>
                            setLines({
                              ...lines,
                              [shipment.shipmentId]: { ...line, codFee: event.target.value },
                            })
                          }
                          className="h-9 w-20"
                        />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* ---- the arithmetic, shown as it is entered */}
            <dl className="flex flex-col gap-1.5 rounded-lg bg-surface-alt p-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">{copy.form.codTotal}</dt>
                <dd className="tabular-nums">{formatBDT(totals.cod)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">{copy.form.chargesTotal}</dt>
                <dd className="tabular-nums">−{formatBDT(totals.charges)}</dd>
              </div>
              <div className="flex justify-between border-t border-border-subtle pt-1.5 font-display font-semibold">
                <dt>{copy.form.expected}</dt>
                <dd className="tabular-nums">{formatBDT(totals.expected)}</dd>
              </div>
              <div
                className={`flex justify-between ${
                  Math.abs(totals.difference) < 0.005 ? "text-text-secondary" : "text-danger"
                }`}
              >
                <dt>{copy.form.difference}</dt>
                <dd className="tabular-nums">{formatBDT(totals.difference)}</dd>
              </div>
            </dl>

            {error ? <FormNotice tone="error">{error}</FormNotice> : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {copy.form.cancel}
              </Button>
              <Button type="submit" disabled={pending || selected.length === 0}>
                {pending ? copy.form.saving : copy.form.submit}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
