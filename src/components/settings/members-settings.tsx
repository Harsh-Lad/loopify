"use client";

import { IconUserMinus, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { useShell } from "@/components/app/shell-context";
import { UserAvatar } from "@/components/app/user-avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

const ROLES = [
  ["OWNER", "Owner", "Everything, including billing and ownership"],
  ["ADMIN", "Admin", "Manage people, teams and settings"],
  ["MANAGER", "Manager", "Create teams, see everyone's reports"],
  ["MEMBER", "Member", "Work on boards, see their own reports"],
] as const;

export function MembersSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const org = useQuery(trpc.org.current.queryOptions());
  const me = useQuery(trpc.me.get.queryOptions());
  const members = useQuery(trpc.org.members.queryOptions());
  const isAdmin = Boolean(org.data && ["OWNER", "ADMIN"].includes(org.data.role));
  const invites = useQuery({ ...trpc.org.invites.queryOptions(), enabled: isAdmin });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.org.members.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.org.invites.queryKey() });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));

  const { setInviteOpen } = useShell();
  const resend = useMutation(
    trpc.org.invite.mutationOptions({
      onSuccess: (res) => {
        refresh();
        toast.success(res.emailed ? `Invite sent again to ${res.email}` : "New invite link ready", {
          description: res.emailed ? undefined : "The email didn't go out. Copy the link and send it yourself.",
          action: { label: "Copy link", onClick: () => void navigator.clipboard.writeText(res.link) },
        });
      },
      onError,
    }),
  );
  const updateMember = useMutation(trpc.org.updateMember.mutationOptions({ onSuccess: refresh, onError }));
  const removeMember = useMutation(
    trpc.org.removeMember.mutationOptions({
      onSuccess: () => (refresh(), toast("Removed from the organization")),
      onError,
    }),
  );
  const revoke = useMutation(trpc.org.revokeInvite.mutationOptions({ onSuccess: refresh, onError }));

  return (
    <div className="space-y-6">
      {isAdmin && (
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="font-heading">Invite people</CardTitle>
              <CardDescription>
                They get an email and a link. They set a password, confirm a code and land straight in {org.data?.name}.
              </CardDescription>
            </div>
            <Button onClick={() => setInviteOpen(true)}>
              <IconUserPlus />
              Invite someone
            </Button>
          </CardHeader>
          {invites.data && invites.data.length > 0 && (
            <CardContent>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Waiting to join</p>
              <ul className="space-y-1.5">
                {invites.data.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate">{i.email}</span>
                    <Badge variant="outline">{i.role.toLowerCase()}</Badge>
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      sent {formatDistanceToNowStrict(i.createdAt, { addSuffix: true })}
                    </span>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={resend.isPending}
                      onClick={() => resend.mutate({ email: i.email, role: i.role })}
                    >
                      Resend
                    </Button>
                    <Button size="xs" variant="ghost" onClick={() => revoke.mutate({ inviteId: i.id })}>
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading">People in {org.data?.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!members.data && <Skeleton className="h-32" />}
          {members.data?.map((m) => {
            const self = m.user.id === me.data?.id;
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3">
                <UserAvatar name={m.user.name} image={m.user.image} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {m.user.name} {self && <span className="text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.user.email}
                    {m.teams.length > 0 && `, on ${m.teams.map((t) => t.name).join(", ")}`}
                  </p>
                </div>
                {isAdmin && !self ? (
                  <Select
                    value={m.role}
                    onValueChange={(r) => updateMember.mutate({ memberId: m.id, role: r as never })}
                  >
                    <SelectTrigger size="sm" className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="secondary" className="capitalize">
                    {m.role.toLowerCase()}
                  </Badge>
                )}
                {(isAdmin || self) && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={self ? "Leave organization" : `Remove ${m.user.name}`}
                      >
                        <IconUserMinus />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {self ? `Leave ${org.data?.name}?` : `Remove ${m.user.name}?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {self
                            ? "You'll lose access to its boards."
                            : "They'll lose access to every board. Their cards stay where they are."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction onClick={() => removeMember.mutate({ memberId: m.id })}>
                          {self ? "Leave" : "Remove"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
