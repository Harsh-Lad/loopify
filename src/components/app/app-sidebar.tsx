"use client";

import {
  IconCalendarMonth,
  IconChartBar,
  IconLayoutDashboard,
  IconShieldLock,
  IconCheck,
  IconChevronRight,
  IconLayoutKanban,
  IconLogout,
  IconMoon,
  IconPlus,
  IconSelector,
  IconSettings,
  IconSparkles,
  IconSun,
  IconSunHigh,
  IconTable,
  IconTemplate,
  IconUserPlus,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { DynamicIcon } from "@/components/app/dynamic-icon";
import { useShell } from "@/components/app/shell-context";
import { UserAvatar } from "@/components/app/user-avatar";
import { LogoMark } from "@/components/brand/logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
  { href: "/today", label: "Today", icon: IconSunHigh },
  { href: "/my-board", label: "My board", icon: IconLayoutKanban },
  { href: "/capture", label: "Capture", icon: IconSparkles },
  { href: "/sheets", label: "Sheets", icon: IconTable },
  { href: "/calendar", label: "Calendar", icon: IconCalendarMonth },
  { href: "/reports", label: "Reports", icon: IconChartBar },
];

export function AppSidebar() {
  const trpc = useTRPC();
  const pathname = usePathname();
  const me = useQuery(trpc.me.get.queryOptions());
  const org = useQuery(trpc.org.current.queryOptions());
  const teams = useQuery(trpc.team.list.queryOptions());
  const boards = useQuery(trpc.board.list.queryOptions());
  const personalBoardId = boards.data?.find((b) => b.ownerId)?.id;
  const captures = useQuery(trpc.capture.list.queryOptions({ limit: 20 }));
  const pendingSuggestions = captures.data?.reduce((sum, c) => sum + c._count.suggestions, 0) ?? 0;
  const canManage = org.data && ["OWNER", "ADMIN", "MANAGER"].includes(org.data.role);
  const isAdmin = org.data && ["OWNER", "ADMIN"].includes(org.data.role);
  const { setInviteOpen } = useShell();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-1">
        <BrandLink />
        <OrgSwitcher />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname.startsWith(item.href) ||
                      (item.href === "/my-board" && pathname === `/boards/${personalBoardId}`)
                    }
                    tooltip={item.label}
                  >
                    <Link
                      href={item.href === "/my-board" && personalBoardId ? `/boards/${personalBoardId}` : item.href}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {item.href === "/capture" && pendingSuggestions > 0 && (
                    <SidebarMenuBadge className="bg-primary text-primary-foreground">
                      {pendingSuggestions}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Teams</SidebarGroupLabel>
          {canManage && (
            <SidebarGroupAction asChild title="New team">
              <Link href="/teams?new=1">
                <IconPlus />
                <span className="sr-only">New team</span>
              </Link>
            </SidebarGroupAction>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {teams.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuSkeleton showIcon />
                  </SidebarMenuItem>
                ))}
              {teams.data?.map((team) => (
                <Collapsible key={team.id} defaultOpen={team.isMember} className="group/collapsible" asChild>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={team.name}>
                        <span
                          className={cn("grid size-5 place-items-center rounded-md text-white", `tint-${team.color}`)}
                          style={{ background: "var(--tint)" }}
                        >
                          <DynamicIcon name={team.icon} className="size-3.5" stroke={2.2} />
                        </span>
                        <span className="truncate">{team.name}</span>
                        <IconChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {team.boards.map((board) => (
                          <SidebarMenuSubItem key={board.id}>
                            <SidebarMenuSubButton asChild isActive={pathname === `/boards/${board.id}`}>
                              <Link href={`/boards/${board.id}`}>
                                <IconLayoutKanban />
                                <span>{board.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton asChild className="text-muted-foreground">
                            <Link href={`/teams/${team.id}`}>
                              <IconUsersGroup />
                              <span>Team page</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Invite people"
                    onClick={() => setInviteOpen(true)}
                    className="bg-primary/25 font-medium text-foreground hover:bg-primary/40"
                  >
                    <IconUserPlus />
                    <span>Invite people</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              {me.data?.isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith("/admin")} tooltip="Platform admin">
                    <Link href="/admin">
                      <IconShieldLock />
                      <span>Platform admin</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/templates")} tooltip="Workflows">
                  <Link href="/templates">
                    <IconTemplate />
                    <span>Workflows</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith("/settings")} tooltip="Settings">
                  <Link href="/settings">
                    <IconSettings />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        {me.data && <UserMenu name={me.data.name} email={me.data.email} image={me.data.image} />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

/** The product mark and name, always at the very top. */
function BrandLink() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild size="lg" tooltip="Loopify" className="hover:bg-transparent active:bg-transparent">
          <Link href="/dashboard" aria-label="Loopify home">
            {/* size-8! beats the menu button's [&_svg]:size-4 icon rule. */}
            <LogoMark className="size-8! shrink-0" />
            <span className="font-wordmark text-[1.35rem] leading-none font-extrabold tracking-[-0.02em]">loopify</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function OrgSwitcher() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const me = useQuery(trpc.me.get.queryOptions());
  const active = me.data?.orgs.find((o) => o.id === me.data?.activeOrgId);
  const switchOrg = useMutation(
    trpc.me.setActiveOrg.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries();
        router.push("/today");
        toast.success("Switched organization");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={active ? `${active.name} · ${active.role.toLowerCase()}` : "Organization"}
              className="border bg-sidebar-accent/40 data-[state=open]:bg-sidebar-accent group-data-[collapsible=icon]:border-0"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
                {(active?.name ?? "L").charAt(0).toUpperCase()}
              </span>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-heading font-semibold">{active?.name ?? "Your organization"}</span>
                <span className="truncate text-xs text-muted-foreground capitalize">{active?.role.toLowerCase()}</span>
              </div>
              <IconSelector className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
            {me.data?.orgs.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => org.id !== active?.id && switchOrg.mutate({ orgId: org.id })}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-md bg-secondary font-heading text-xs font-bold text-secondary-foreground">
                  {org.name.charAt(0).toUpperCase()}
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate">{org.name}</span>
                  <span className="truncate text-xs text-muted-foreground capitalize">{org.role.toLowerCase()}</span>
                </span>
                {org.id === active?.id && <IconCheck className="ml-auto size-4 text-brand" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding?new=1">
                <IconPlus />
                New organization
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

function UserMenu({ name, email, image }: { name: string; email: string; image: string | null }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <UserAvatar name={name} image={image} className="size-8" />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <IconSelector className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-60">
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <IconSettings />
                Profile and settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              {resolvedTheme === "dark" ? <IconSun /> : <IconMoon />}
              {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => signOut({ redirectTo: "/sign-in" })}>
              <IconLogout />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/** Shown while the route (and its pathname) streams in. */
export function AppSidebarFallback() {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <div className="flex items-center gap-2 p-2">
          <LogoMark className="size-8 shrink-0" />
          <span className="font-wordmark text-[1.35rem] leading-none font-extrabold tracking-[-0.02em] group-data-[collapsible=icon]:hidden">
            loopify
          </span>
        </div>
        <SidebarMenuSkeleton showIcon className="h-12" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu className="p-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
