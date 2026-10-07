"use client";

import { IconBan, IconDots, IconEye, IconRestore } from "@tabler/icons-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminsOnly,
  DailyAreaChart,
  isForbidden,
  PAGE_SIZE,
  Pager,
  SearchBox,
  StatusBadge,
  useDebounced,
} from "@/components/admin/admin-shared";
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
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type OrgRow = RouterOutputs["admin"]["orgs"]["rows"][number];

const ago = (d: Date | null | undefined, never = "Never") =>
  d ? formatDistanceToNowStrict(d, { addSuffix: true }) : never;

export function AdminOrgs() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [cursor, setCursor] = useState(0);
  const query = useDebounced(search.trim());
  const [viewing, setViewing] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const view = (id: string) => {
    setViewing(id);
    setSheetOpen(true);
  };
  const [confirm, setConfirm] = useState<OrgRow | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ask = (o: OrgRow) => {
    setConfirm(o);
    setConfirmOpen(true);
  };

  const orgs = useQuery({
    ...trpc.admin.orgs.queryOptions({ query, cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const setSuspended = useMutation(
    trpc.admin.setOrgSuspended.mutationOptions({
      onSuccess: (res) => {
        toast.success(res.suspendedAt ? "Organization suspended" : "Organization restored");
        void queryClient.invalidateQueries({ queryKey: trpc.admin.orgs.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.admin.org.queryKey({ orgId: res.id }) });
        void queryClient.invalidateQueries({ queryKey: trpc.admin.overview.queryKey() });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  if (isForbidden(orgs.error)) return <AdminsOnly />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setCursor(0);
          }}
          placeholder="Search by name or slug"
        />
        {orgs.isFetching && orgs.data && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {orgs.error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(orgs.error)}</p>
        ) : !orgs.data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead className="hidden md:table-cell">Owner</TableHead>
                  <TableHead className="text-right">People</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Teams</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Boards</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Cards</TableHead>
                  <TableHead className="hidden xl:table-cell">Created</TableHead>
                  <TableHead className="hidden md:table-cell">Last active</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                      {query ? `No organizations match “${query}”.` : "No organizations yet."}
                    </TableCell>
                  </TableRow>
                )}
                {orgs.data.rows.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="max-w-56">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-medium hover:underline"
                        onClick={() => view(o.id)}
                      >
                        {o.name}
                      </button>
                      <span className="block truncate text-xs text-muted-foreground">/{o.slug}</span>
                    </TableCell>
                    <TableCell className="hidden max-w-48 md:table-cell">
                      {o.owner ? (
                        <>
                          <span className="block truncate">{o.owner.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{o.owner.email}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No owner</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.counts.members}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{o.counts.teams}</TableCell>
                    <TableCell className="hidden text-right tabular-nums lg:table-cell">{o.counts.boards}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{o.counts.cards}</TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">
                      {format(o.createdAt, "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{ago(o.lastActiveAt)}</TableCell>
                    <TableCell>
                      <StatusBadge suspendedAt={o.suspendedAt} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${o.name}`}>
                            <IconDots />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => view(o.id)}>
                            <IconEye />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {o.suspendedAt ? (
                            <DropdownMenuItem onSelect={() => ask(o)}>
                              <IconRestore />
                              Restore
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onSelect={() => ask(o)}>
                              <IconBan />
                              Suspend
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager
              cursor={cursor}
              count={orgs.data.rows.length}
              total={orgs.data.total}
              nextCursor={orgs.data.nextCursor}
              onChange={setCursor}
              noun="organizations"
            />
          </>
        )}
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.suspendedAt ? `Restore ${confirm?.name}?` : `Suspend ${confirm?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.suspendedAt
                ? "Its members get their boards back straight away."
                : "Every member loses access to its boards until you restore it. Nothing is deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={confirm?.suspendedAt ? "default" : "destructive"}
              onClick={() => confirm && setSuspended.mutate({ orgId: confirm.id, suspended: !confirm.suspendedAt })}
            >
              {confirm?.suspendedAt ? "Restore" : "Suspend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <OrgSheet orgId={viewing} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
}

function OrgSheet({
  orgId,
  open,
  onOpenChange,
}: {
  orgId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const org = useQuery({ ...trpc.admin.org.queryOptions({ orgId: orgId ?? "" }), enabled: orgId != null });
  const data = orgId ? org.data : undefined;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle className="font-heading text-lg">{data?.name ?? "Organization"}</SheetTitle>
          <SheetDescription>
            {data ? `/${data.slug} · created ${format(data.createdAt, "d MMM yyyy")}` : "Loading…"}
          </SheetDescription>
          {data && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              <StatusBadge suspendedAt={data.suspendedAt} />
              <Badge variant="outline">{data._count.cards} cards</Badge>
              <Badge variant="outline">{data._count.captures} captures</Badge>
              <Badge variant="outline">{data._count.events} events</Badge>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {org.error ? (
            <p className="text-sm text-destructive">{errorMessage(org.error)}</p>
          ) : !data ? (
            <div className="space-y-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <>
              <section>
                <h3 className="mb-1 text-sm font-medium">Activity</h3>
                <p className="mb-2 text-xs text-muted-foreground">Card events per day, last 30 days</p>
                <DailyAreaChart
                  data={data.activity}
                  dataKey="count"
                  label="Events"
                  color="var(--chart-1)"
                  className="h-32"
                />
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">People ({data.members.length})</h3>
                <ul className="space-y-2.5">
                  {data.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <UserAvatar name={m.user.name} image={m.user.image} className="size-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {m.user.name}
                          {m.user.suspendedAt && <span className="ml-1.5 text-xs text-destructive">suspended</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.user.email} · seen {ago(m.user.lastSeenAt, "never")}
                        </p>
                      </div>
                      <Badge variant={m.role === "OWNER" ? "default" : "secondary"} className="capitalize">
                        {m.role.toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-sm font-medium">Teams ({data.teams.length})</h3>
                {data.teams.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No teams yet.</p>
                ) : (
                  <ul className="divide-y rounded-xl border">
                    {data.teams.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="truncate">{t.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {t._count.members} people · {t._count.boards} boards
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
