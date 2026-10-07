"use client";

import { IconLayoutKanban, IconMail, IconPlus, IconUserMinus, IconUserPlus } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { useShell } from "@/components/app/shell-context";
import { UserAvatar } from "@/components/app/user-avatar";
import { PageBody } from "@/components/common/page-header";
import { TemplatePicker } from "@/components/common/template-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

export function TeamDetail({ teamId }: { teamId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const team = useQuery(trpc.team.get.queryOptions({ teamId }));
  const members = useQuery(trpc.org.members.queryOptions());
  const me = useQuery(trpc.me.get.queryOptions());
  const [adding, setAdding] = useState<string>("");
  const [boardOpen, setBoardOpen] = useState(false);
  const { setInviteOpen } = useShell();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.team.get.queryKey({ teamId }) });
    void queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const addMember = useMutation(
    trpc.team.addMember.mutationOptions({ onSuccess: () => (refresh(), setAdding("")), onError }),
  );
  const removeMember = useMutation(trpc.team.removeMember.mutationOptions({ onSuccess: refresh, onError }));

  if (!team.data)
    return (
      <PageBody>
        <Skeleton className="h-96 rounded-2xl" />
      </PageBody>
    );
  const t = team.data;
  const outside = members.data?.filter((m) => !t.members.some((tm) => tm.userId === m.user.id)) ?? [];

  return (
    <PageBody>
      <div className="flex items-center gap-4">
        <span
          className={`grid size-14 place-items-center rounded-2xl text-white tint-${t.color}`}
          style={{ background: "var(--tint)" }}
        >
          <DynamicIcon name={t.icon} className="size-7" stroke={2} />
        </span>
        <div>
          <h1 className="text-3xl font-bold">{t.name}</h1>
          {t.description && <p className="text-muted-foreground">{t.description}</p>}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="font-heading">Boards</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setBoardOpen(true)}>
              <IconPlus />
              New board
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.boards.map((b) => (
              <Link
                key={b.id}
                href={`/boards/${b.id}`}
                className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted"
              >
                <IconLayoutKanban className="size-5 text-brand" />
                <span className="flex-1 font-medium">{b.name}</span>
                <span className="text-xs text-muted-foreground">{b.key}</span>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle className="font-heading">People</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
              <IconMail />
              Invite to Loopify
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {t.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <UserAvatar name={m.user.name} image={m.user.image} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                </div>
                {m.role === "LEAD" && <Badge variant="highlight">Lead</Badge>}
                <Select
                  value={m.role}
                  onValueChange={(role) =>
                    addMember.mutate({ teamId, userId: m.userId, role: role as "LEAD" | "MEMBER" })
                  }
                >
                  <SelectTrigger size="sm" className="w-24" aria-label="Team role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LEAD">Lead</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={m.userId === me.data?.id ? "Leave team" : `Remove ${m.user.name}`}
                  onClick={() => removeMember.mutate({ teamId, userId: m.userId })}
                >
                  <IconUserMinus />
                </Button>
              </div>
            ))}
            {outside.length > 0 && (
              <div className="flex gap-2 pt-3">
                <Select value={adding} onValueChange={setAdding}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Add someone from the org" />
                  </SelectTrigger>
                  <SelectContent>
                    {outside.map((m) => (
                      <SelectItem key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!adding || addMember.isPending}
                  onClick={() => addMember.mutate({ teamId, userId: adding })}
                >
                  <IconUserPlus />
                  Add
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <NewBoardDialog teamId={teamId} open={boardOpen} onOpenChange={setBoardOpen} />
    </PageBody>
  );
}

function NewBoardDialog({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("tpl_general");
  const create = useMutation(
    trpc.board.create.mutationOptions({
      onSuccess: (board) => {
        void queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        onOpenChange(false);
        router.push(`/boards/${board.id}`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">New board</DialogTitle>
          <DialogDescription>A board is one stream of work, like a client account or a campaign.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="board-name">Board name</FieldLabel>
            <Input
              id="board-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Diwali campaign"
            />
          </Field>
          <Field>
            <FieldLabel>Workflow</FieldLabel>
            <TemplatePicker value={templateId} onChange={setTemplateId} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            disabled={name.trim().length < 2 || create.isPending}
            onClick={() => create.mutate({ teamId, name, templateId })}
          >
            Create board
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
