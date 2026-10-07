"use client";

import { IconPlus, IconUsers } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { NewTeamDialog } from "@/components/teams/new-team-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";

export function TeamsView() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const [open, setOpen] = useState(params.get("new") === "1");
  const teams = useQuery(trpc.team.list.queryOptions());
  const org = useQuery(trpc.org.current.queryOptions());
  const canManage = org.data && ["OWNER", "ADMIN", "MANAGER"].includes(org.data.role);
  const join = useMutation(
    trpc.team.join.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() }),
    }),
  );

  return (
    <PageBody>
      <PageHeader
        title="Teams"
        description="People can be on as many teams as they like. Each team works its own way."
        actions={
          canManage && (
            <Button onClick={() => setOpen(true)}>
              <IconPlus />
              New team
            </Button>
          )
        }
      />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {teams.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
        {teams.data?.map((team) => (
          <Card key={team.id} className="group transition-shadow hover:shadow-md">
            <CardHeader className="flex items-center gap-3">
              <span
                className={`grid size-10 place-items-center rounded-xl text-white transition-transform group-hover:-rotate-6 tint-${team.color}`}
                style={{ background: "var(--tint)" }}
              >
                <DynamicIcon name={team.icon} className="size-5" stroke={2} />
              </span>
              <div className="min-w-0">
                <CardTitle className="truncate font-heading text-lg">
                  <Link href={`/teams/${team.id}`} className="after:absolute after:inset-0">
                    {team.name}
                  </Link>
                </CardTitle>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <IconUsers className="size-3.5" />
                  {team.memberCount} {team.memberCount === 1 ? "person" : "people"}
                </p>
              </div>
              {team.isLead ? (
                <Badge variant="highlight" className="ml-auto">
                  Lead
                </Badge>
              ) : team.isMember ? (
                <Badge variant="secondary" className="ml-auto">
                  Member
                </Badge>
              ) : null}
            </CardHeader>
            <CardContent className="relative flex flex-wrap gap-1.5">
              {team.boards.map((b) => (
                <Button
                  key={b.id}
                  size="xs"
                  variant="outline"
                  className="relative z-10"
                  onClick={() => router.push(`/boards/${b.id}`)}
                >
                  {b.name}
                </Button>
              ))}
              {!team.isMember && (
                <Button size="xs" className="relative z-10" onClick={() => join.mutate({ teamId: team.id })}>
                  Join team
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      <NewTeamDialog open={open} onOpenChange={setOpen} />
    </PageBody>
  );
}
