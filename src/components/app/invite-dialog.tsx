"use client";

import { IconCheck, IconCopy, IconMail, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useShell } from "@/components/app/shell-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export const ROLE_OPTIONS = [
  { value: "MEMBER", label: "Member", hint: "Works on boards, sees their own reports" },
  { value: "MANAGER", label: "Manager", hint: "Creates teams, sees everyone's reports" },
  { value: "ADMIN", label: "Admin", hint: "Manages people, teams and settings" },
  { value: "OWNER", label: "Owner", hint: "Everything, including ownership" },
] as const;

type Role = (typeof ROLE_OPTIONS)[number]["value"];

/** Invite a teammate by email. Always shows a copyable link, so it works even when email doesn't. */
export function InviteDialog() {
  const { inviteOpen, setInviteOpen } = useShell();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [copied, setCopied] = useState(false);

  const invite = useMutation(
    trpc.org.invite.mutationOptions({
      onSuccess: (res) => {
        void queryClient.invalidateQueries({ queryKey: trpc.org.invites.queryKey() });
        if (res.emailed) toast.success(`Invite sent to ${res.email}`);
      },
    }),
  );

  const reset = () => {
    invite.reset();
    setEmail("");
    setRole("MEMBER");
    setCopied(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    invite.mutate({ email, role });
  };

  const copy = async (link: string) => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success("Invite link copied");
  };

  return (
    <Dialog
      open={inviteOpen}
      onOpenChange={(open) => {
        setInviteOpen(open);
        if (!open) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xl">
            <IconUserPlus className="size-5 text-brand" />
            Invite someone
          </DialogTitle>
          <DialogDescription>
            They&apos;ll pick a password, confirm a code and land straight in Loopify.
          </DialogDescription>
        </DialogHeader>

        {invite.data ? (
          <div className="space-y-4">
            {invite.data.emailed ? (
              <Alert>
                <IconMail />
                <AlertTitle>Invite emailed to {invite.data.email}</AlertTitle>
                <AlertDescription>You can also send them this link yourself.</AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <IconMail />
                <AlertTitle>The email didn&apos;t go out</AlertTitle>
                <AlertDescription>
                  The invite is ready though. Send this link to {invite.data.email} on WhatsApp, Slack or anywhere else.
                </AlertDescription>
              </Alert>
            )}
            <InputGroup>
              <InputGroupInput readOnly value={invite.data.link} onFocus={(e) => e.currentTarget.select()} />
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" aria-label="Copy invite link" onClick={() => copy(invite.data!.link)}>
                  {copied ? <IconCheck /> : <IconCopy />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <p className="text-xs text-muted-foreground">The link works once and expires in 7 days.</p>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>
                Invite another
              </Button>
              <Button onClick={() => setInviteOpen(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={invite.isError || undefined}>
                <FieldLabel htmlFor="invite-email">Email</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  autoFocus
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <FieldError>{invite.error ? errorMessage(invite.error) : null}</FieldError>
              </Field>
              <Field>
                <FieldLabel>Role</FieldLabel>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span>
                          {r.label}
                          <span className="block text-xs text-muted-foreground">{r.hint}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" disabled={!email.includes("@") || invite.isPending}>
                {invite.isPending ? <Spinner /> : <IconMail />}
                Send invite
              </Button>
            </FieldGroup>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
