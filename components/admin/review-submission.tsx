"use client";

import { Check, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { reviewSubmissionAction } from "@/app/(dashboard)/admin/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBDT } from "@/lib/format";
import type { Messages } from "@/lib/i18n";

/**
 * Approving is a money decision and cannot be undone, so both buttons open a dialog
 * that repeats exactly what is being accepted.
 */
export function ReviewSubmission({
  admin,
  submission,
}: {
  admin: Messages["admin"];
  submission: {
    id: string;
    organization_id: string;
    organization_name: string;
    plan_code: string;
    months: number;
    amount: number;
    method: string;
    transaction_id: string;
  };
}) {
  const router = useRouter();
  const copy = admin.review;

  const [openApprove, setOpenApprove] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const summary = copy.summary
    .replace("{plan}", submission.plan_code)
    .replace("{months}", String(submission.months))
    .replace("{amount}", formatBDT(submission.amount))
    .replace("{method}", submission.method.toUpperCase())
    .replace("{trx}", submission.transaction_id);

  const review = async (approve: boolean) => {
    setPending(true);
    setError(null);

    const result = await reviewSubmissionAction({
      submissionId: submission.id,
      approve,
      note,
      organizationId: submission.organization_id,
    });

    setPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }

    setOpenApprove(false);
    setOpenReject(false);
    setNote("");
    router.refresh();
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog open={openApprove} onOpenChange={setOpenApprove}>
        <DialogTrigger asChild>
          <Button size="sm">
            <Check />
            {copy.approve}
          </Button>
        </DialogTrigger>
        <DialogContent title={copy.approveTitle} description={copy.approveBody}>
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-surface-alt px-4 py-3 text-sm text-text-primary">
              <span className="font-medium">{submission.organization_name}</span>
              <br />
              {summary}
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`approve-note-${submission.id}`}>{copy.noteLabel}</Label>
              <Input
                id={`approve-note-${submission.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            {error && <FormNotice tone="error">{error}</FormNotice>}

            <div className="flex items-center gap-2">
              <Button disabled={pending} onClick={() => review(true)}>
                {copy.approve}
              </Button>
              <DialogClose asChild>
                <Button variant="ghost">{admin.manage.cancel}</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openReject} onOpenChange={setOpenReject}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-tint">
            <X />
            {copy.reject}
          </Button>
        </DialogTrigger>
        <DialogContent title={copy.rejectTitle} description={copy.rejectBody}>
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-surface-alt px-4 py-3 text-sm text-text-primary">{summary}</p>

            <div className="flex flex-col gap-2">
              <Label htmlFor={`reject-note-${submission.id}`}>{copy.noteLabel}</Label>
              <Input
                id={`reject-note-${submission.id}`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={copy.rejectNotePlaceholder}
              />
            </div>

            {error && <FormNotice tone="error">{error}</FormNotice>}

            <div className="flex items-center gap-2">
              <Button variant="destructive" disabled={pending} onClick={() => review(false)}>
                {copy.reject}
              </Button>
              <DialogClose asChild>
                <Button variant="ghost">{admin.manage.cancel}</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
