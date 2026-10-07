"use client";

import { IconSearch, IconSparkles } from "@tabler/icons-react";
import { Suspense, type ReactNode } from "react";
import { AppSidebar, AppSidebarFallback } from "@/components/app/app-sidebar";
import { CommandPalette } from "@/components/app/command-palette";
import { InviteDialog } from "@/components/app/invite-dialog";
import { NotificationBell } from "@/components/app/notification-bell";
import { QuickCaptureDialog } from "@/components/app/quick-capture-dialog";
import { useHydrated } from "@/components/common/client-view";
import { ShellProvider, useShell } from "@/components/app/shell-context";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  return (
    <ShellProvider>
      <SidebarProvider>
        {/* Client-only: the sidebar switches to a sheet on phones, which the server can't know. */}
        {hydrated ? (
          <Suspense fallback={<AppSidebarFallback />}>
            <AppSidebar />
          </Suspense>
        ) : (
          <AppSidebarFallback />
        )}
        <SidebarInset className="min-w-0">
          <TopBar />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
        <CommandPalette />
        <QuickCaptureDialog />
        <InviteDialog />
      </SidebarProvider>
    </ShellProvider>
  );
}

function TopBar() {
  const { setCommandOpen, openCapture } = useShell();
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/85 px-3 backdrop-blur">
      <SidebarTrigger />
      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
      <Button
        variant="outline"
        className="h-8 min-w-0 flex-1 justify-start gap-2 text-muted-foreground sm:max-w-72"
        onClick={() => setCommandOpen(true)}
      >
        <IconSearch />
        <span className="truncate">Search or jump to...</span>
        <Kbd className="ml-auto hidden sm:inline-flex">Ctrl K</Kbd>
      </Button>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button size="sm" onClick={() => openCapture()} className="gap-1.5">
          <IconSparkles />
          <span className="hidden sm:inline">Capture</span>
        </Button>
        <NotificationBell />
      </div>
    </header>
  );
}
