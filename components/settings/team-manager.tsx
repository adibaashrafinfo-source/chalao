"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, Trash2 } from "lucide-react";

import {
  changeRoleAction,
  createInvitationAction,
  removeMemberAction,
  revokeInvitationAction,
} from "@/app/(dashboard)/settings/team/actions";
import { FormNotice } from "@/components/auth/login-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Messages } from "@/lib/i18n";
import type { Invitation, TeamMember } from "@/lib/team/queries";

const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const selectClass =
  "h-10 rounded-md border border-transparent bg-surface-alt px-4 text-sm text-text-primary outline-none focus-visible:border-brand-lime focus-visible:ring-[3px] focus-visible:ring-brand-lime/30";

export function TeamManager({
  copy,
  members,
  invitations,
  currentUserId,
  isOwner,
  atLimit,
  siteUrl,
}: {
  copy: Messages["team"];
  members: TeamMember[];
  invitations: Invitation[];
  currentUserId: string;
  isOwner: boolean;
  atLimit: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [notice, setNotice] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const linkFor = (token: string) => `${siteUrl}/invite/${token}`;

  const copy_ = async (id: string, token: string) => {
    await navigator.clipboard.writeText(linkFor(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const run = async (work: () => Promise<{ error?: string }>) => {
    setPending(true);
    setNotice(null);
    const result = await work();
    setPending(false);
    if (result?.error) setNotice({ tone: "error", text: result.error });
    router.refresh();
  };

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setNotice(null);
    const result = await createInvitationAction({ email, role });
    setPending(false);
    if (result.error) {
      setNotice({ tone: "error", text: result.error });
      return;
    }
    setEmail("");
    setNotice({ tone: "info", text: copy.invite.created });
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4">
      {notice ? <FormNotice tone={notice.tone}>{notice.text}</FormNotice> : null}
      {!isOwner ? <FormNotice>{copy.ownerOnly}</FormNotice> : null}

      {/* ---- invite ---- */}
      {isOwner ? (
        <section className="flex flex-col gap-4 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-base font-semibold text-brand-dark">{copy.invite.title}</h2>
            <p className="text-sm leading-relaxed text-text-secondary">{copy.invite.body}</p>
          </div>

          {atLimit ? (
            <FormNotice tone="error">{copy.limitReached}</FormNotice>
          ) : (
            <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="invite-email">{copy.invite.email}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="invite-role">{copy.invite.role}</Label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  className={selectClass}
                >
                  <option value="staff">{copy.roles.staff}</option>
                  <option value="manager">{copy.roles.manager}</option>
                </select>
              </div>
              <Button type="submit" disabled={pending || !email.trim()}>
                {pending ? copy.invite.creating : copy.invite.create}
              </Button>
            </form>
          )}
        </section>
      ) : null}

      {/* ---- open invitations ---- */}
      {isOwner ? (
        <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
          <h2 className="font-display text-base font-semibold text-brand-dark">{copy.pending.title}</h2>
          {invitations.length === 0 ? (
            <p className="text-sm text-text-secondary">{copy.pending.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invitations.map((invitation) => (
                <li
                  key={invitation.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-alt px-4 py-3"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-brand-dark">{invitation.email}</span>
                    <span className="text-xs text-text-muted">
                      {copy.roles[invitation.role]} · {copy.pending.expires}{" "}
                      {dateFormatter.format(new Date(invitation.expiresAt))}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copy_(invitation.id, invitation.token)}
                  >
                    {copiedId === invitation.id ? <Check /> : <Copy />}
                    {copiedId === invitation.id ? copy.pending.copied : copy.pending.copy}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => run(() => revokeInvitationAction(invitation.id))}
                  >
                    {copy.pending.revoke}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* ---- members ---- */}
      <section className="flex flex-col gap-3 rounded-xl bg-surface p-5 shadow-xs sm:p-6">
        <h2 className="font-display text-base font-semibold text-brand-dark">{copy.members.title}</h2>
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const isYou = member.userId === currentUserId;
            const editable = isOwner && member.role !== "owner";
            return (
              <li key={member.memberId} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-alt px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm text-brand-dark">
                    {member.fullName || member.email}
                    {isYou ? <span className="text-text-muted"> ({copy.members.you})</span> : null}
                  </span>
                  <span className="truncate text-xs text-text-muted">
                    {member.email} · {copy.members.joined} {dateFormatter.format(new Date(member.joinedAt))}
                  </span>
                </span>

                {editable ? (
                  <>
                    <select
                      aria-label={copy.invite.role}
                      value={member.role}
                      disabled={pending}
                      onChange={(event) => run(() => changeRoleAction(member.memberId, event.target.value))}
                      className={selectClass}
                    >
                      <option value="staff">{copy.roles.staff}</option>
                      <option value="manager">{copy.roles.manager}</option>
                    </select>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-tint">
                          <Trash2 />
                        </Button>
                      </DialogTrigger>
                      <DialogContent title={copy.members.removeTitle} description={copy.members.removeBody}>
                        <Button
                          variant="destructive"
                          disabled={pending}
                          onClick={() => run(() => removeMemberAction(member.memberId))}
                        >
                          {copy.members.removeConfirm}
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <Badge variant={member.role === "owner" ? "brand" : "neutral"}>{copy.roles[member.role]}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
