"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import { deleteCustomerAction } from "@/app/(dashboard)/customers/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { Messages } from "@/lib/i18n";

export function DeleteCustomerButton({
  customers,
  customerId,
  canDelete,
}: {
  customers: Messages["customers"];
  customerId: string;
  /** Staff keep the customer; only a manager or the owner removes one. */
  canDelete: boolean;
}) {
  if (!canDelete) return null;

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-tint">
          <Trash2 />
          {customers.actions.delete}
        </Button>
      </DialogTrigger>
      <DialogContent title={customers.actions.deleteConfirmTitle} description={customers.actions.deleteConfirmBody}>
        {error && <FormNotice tone="error">{error}</FormNotice>}
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              // On success the action redirects to /customers.
              const result = await deleteCustomerAction(customerId);
              setPending(false);
              if (result?.error) setError(result.error);
            }}
          >
            {customers.actions.deleteConfirm}
          </Button>
          <DialogClose asChild>
            <Button variant="ghost">{customers.actions.cancel}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
