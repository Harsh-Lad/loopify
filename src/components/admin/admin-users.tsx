"use client";

import { IconBan, IconDots, IconRestore, IconShieldCheck, IconShieldOff } from "@tabler/icons-react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import {
  AdminsOnly,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type UserRow = RouterOutputs["admin"]["users"]["rows"][number];
type Pending = { kind: "suspend" | "admin"; user: UserRow };

export function AdminUsers() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const me = useQuery(trpc.me.get.queryOptions());
  const [search, setSearch] = useState("");
  const [cursor, setCursor] = useState(0);
  const query = useDebounced(search.trim());
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const ask = (p: Pending) => {
    setPending(p);
    setConfirmOpen(true);
  };

  const users = useQuery({
    ...trpc.admin.users.queryOptions({ query, cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.admin.users.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.admin.overview.queryKey() });
  };
  const onError = (e: unknown) => toast.error(errorMessage(e));
  const setSuspended = useMutation(
    trpc.admin.setUserSuspended.mutationOptions({
      onSuccess: (res) => {
        refresh();
        toast.success(res.suspendedAt ? "Account suspended" : "Account restored");
      },
      onError,
    }),
  );
  const setAdmin = useMutation(
    trpc.admin.setPlatformAdmin.mutationOptions({
      onSuccess: (res) => {
        refresh();
        toast.success(res.isPlatformAdmin ? "Now a platform admin" : "Platform admin access removed");
      },
      onError,
    }),
  );

  if (isForbidden(users.error)) return <AdminsOnly />;

  const confirmCopy = (() => {
    if (!pending) return null;
    const { kind, user } = pending;
    if (kind === "suspend") {
      return user.suspendedAt
        ? {
            title: `Restore ${user.name}?`,
            body: "They can sign in again and pick up where they left off.",
            action: "Restore",
            destructive: false,
          }
        : {
            title: `Suspend ${user.name}?`,
            body: "They're signed out everywhere and can't sign in until you restore them. Their work stays put.",
            action: "Suspend",
            destructive: true,
          };
    }
    return user.isPlatformAdmin
      ? {
          title: `Remove ${user.name}'s platform admin access?`,
          body: user.bootstrapAdmin
            ? "They're also listed in the server's admin environment variable, so they keep access until that changes."
            : "They lose access to this console and every organization in it.",
          action: "Remove access",
          destructive: true,
        }
      : {
          title: `Make ${user.name} a platform admin?`,
          body: "They'll see every organization and person on Loopify, and can suspend any of them.",
          action: "Make admin",
          destructive: false,
        };
  })();

  const run = () => {
    if (!pending) return;
    const { kind, user } = pending;
    if (kind === "suspend") setSuspended.mutate({ userId: user.id, suspended: !user.suspendedAt });
    else setAdmin.mutate({ userId: user.id, admin: !user.isPlatformAdmin });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBox
          value={search}
          onChange={(v) => {
            setSearch(v);
            setCursor(0);
          }}
          placeholder="Search by name or email"
        />
        {users.isFetching && users.data && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        {users.error ? (
          <p className="p-6 text-sm text-destructive">{errorMessage(users.error)}</p>
        ) : !users.data ? (
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
                  <TableHead>Person</TableHead>
                  <TableHead className="hidden lg:table-cell">Email</TableHead>
                  <TableHead className="hidden sm:table-cell">Verified</TableHead>
                  <TableHead className="hidden md:table-cell">Organizations</TableHead>
                  <TableHead className="hidden md:table-cell">Last seen</TableHead>
                  <TableHead className="hidden xl:table-cell">Joined</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                      {query ? `No one matches “${query}”.` : "No people yet."}
                    </TableCell>
                  </TableRow>
                )}
                {users.data.rows.map((u) => {
                  const self = u.id === me.data?.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-64">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={u.name} image={u.image} className="size-8" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 font-medium">
                              <span className="truncate">{u.name}</span>
                              {self && <span className="shrink-0 text-muted-foreground">(you)</span>}
                              {u.isPlatformAdmin && (
                                <Badge className="shrink-0">
                                  <IconShieldCheck />
                                  Admin
                                  {u.bootstrapAdmin && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="rounded-full bg-primary-foreground/15 px-1 text-[10px] uppercase">
                                          env
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Granted by the server&apos;s admin environment variable
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </Badge>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground lg:hidden">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden max-w-56 truncate text-muted-foreground lg:table-cell">
                        {u.email}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {u.emailVerified ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Unverified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-72 md:table-cell">
                        {u.memberships.length === 0 ? (
                          <span className="text-muted-foreground">None</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {u.memberships.slice(0, 3).map((m) => (
                              <Badge key={m.org.id} variant="secondary" className="max-w-40">
                                <span className="truncate">{m.org.name}</span>
                                <span className="text-muted-foreground lowercase">{m.role}</span>
                              </Badge>
                            ))}
                            {u.memberships.length > 3 && <Badge variant="outline">+{u.memberships.length - 3}</Badge>}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {u.lastSeenAt ? formatDistanceToNowStrict(u.lastSeenAt, { addSuffix: true }) : "Never"}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground xl:table-cell">
                        {format(u.createdAt, "d MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge suspendedAt={u.suspendedAt} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${u.name}`}>
                              <IconDots />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {u.isPlatformAdmin ? (
                              <DropdownMenuItem disabled={self} onSelect={() => ask({ kind: "admin", user: u })}>
                                <IconShieldOff />
                                Remove platform admin
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => ask({ kind: "admin", user: u })}>
                                <IconShieldCheck />
                                Make platform admin
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {u.suspendedAt ? (
                              <DropdownMenuItem onSelect={() => ask({ kind: "suspend", user: u })}>
                                <IconRestore />
                                Restore account
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={self}
                                onSelect={() => ask({ kind: "suspend", user: u })}
                              >
                                <IconBan />
                                Suspend account
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pager
              cursor={cursor}
              count={users.data.rows.length}
              total={users.data.total}
              nextCursor={users.data.nextCursor}
              onChange={setCursor}
              noun="people"
            />
          </>
        )}
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmCopy?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmCopy?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant={confirmCopy?.destructive ? "destructive" : "default"} onClick={run}>
              {confirmCopy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
