"use client";

import { AnimatedChartBars } from "@/components/brand/animated-icons";
import {
  IconBrandGoogle,
  IconExternalLink,
  IconMessageCircle,
  IconPlus,
  IconSearch,
  IconTable,
  IconUsers,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

/** Every spreadsheet in the connected Google account, ready to open. */
export function SheetsHome() {
  const trpc = useTRPC();
  const status = useQuery(trpc.sheets.status.queryOptions());
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const [newOpen, setNewOpen] = useState(false);
  const files = useQuery({
    ...trpc.sheets.browse.queryOptions({ query: deferred || undefined }),
    enabled: Boolean(status.data?.connected),
    placeholderData: (prev) => prev,
  });

  if (!status.data) {
    return (
      <PageBody>
        <Skeleton className="h-96 rounded-2xl" />
      </PageBody>
    );
  }

  if (!status.data.connected) {
    return (
      <PageBody>
        <Empty className="rounded-2xl border border-dashed py-20">
          <EmptyHeader>
            <EmptyMedia variant="icon" className="size-14 rounded-2xl bg-brand-soft text-brand">
              <AnimatedChartBars className="size-8" trigger="loop" />
            </EmptyMedia>
            <EmptyTitle>Bring your Google Sheets into Loopify</EmptyTitle>
            <EmptyDescription>
              See every sheet you have, edit cells right here, move rows between sheets, and change things by chatting.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {status.data.googleConfigured ? (
              <Button asChild>
                <a href="/api/integrations/google/connect?returnTo=/sheets">
                  <IconBrandGoogle />
                  Connect Google
                </a>
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                An admin needs to add the Google client ID and secret to the server first.
              </p>
            )}
          </EmptyContent>
        </Empty>
      </PageBody>
    );
  }

  return (
    <PageBody className="max-w-7xl">
      <PageHeader
        title="Sheets"
        description={`Connected as ${status.data.accountEmail ?? "your Google account"}. Open a sheet to edit it or chat with it.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/sheets/chat">
                <IconMessageCircle />
                Chat across sheets
              </Link>
            </Button>
            <Button onClick={() => setNewOpen(true)}>
              <IconPlus />
              New spreadsheet
            </Button>
          </>
        }
      />

      <InputGroup className="mt-6 max-w-md">
        <InputGroupAddon>{files.isFetching ? <Spinner /> : <IconSearch />}</InputGroupAddon>
        <InputGroupInput
          placeholder="Search your sheets by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>

      {files.isError ? (
        <p className="mt-8 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{errorMessage(files.error)}</p>
      ) : !files.data ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : files.data.files.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">
          {deferred ? `No sheets named like "${deferred}".` : "No spreadsheets in this Google account yet."}
        </p>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {files.data.files.map((file) => (
            <Card key={file.id} className="group relative gap-2 py-4 transition-shadow hover:shadow-md">
              <CardContent className="flex items-start gap-3 px-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/15 text-success transition-transform group-hover:-rotate-6">
                  <IconTable className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/sheets/${file.id}`}
                    className="line-clamp-2 font-medium leading-snug after:absolute after:inset-0"
                  >
                    {file.name}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {file.modifiedTime
                      ? `Edited ${formatDistanceToNowStrict(new Date(file.modifiedTime), { addSuffix: true })}`
                      : "Never edited"}
                  </p>
                  {file.shared && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <IconUsers className="size-3.5" /> Shared
                      {file.owner ? `, owned by ${file.owner}` : ""}
                    </p>
                  )}
                </div>
                <Button
                  asChild
                  size="icon-sm"
                  variant="ghost"
                  className="relative z-10 opacity-0 group-hover:opacity-100"
                  aria-label="Open in Google Sheets"
                >
                  <a href={file.url} target="_blank" rel="noreferrer">
                    <IconExternalLink />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <NewSpreadsheetDialog open={newOpen} onOpenChange={setNewOpen} />
    </PageBody>
  );
}

function NewSpreadsheetDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const trpc = useTRPC();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const create = useMutation(
    trpc.sheets.createSpreadsheet.mutationOptions({
      onSuccess: ({ id }) => {
        toast.success("Spreadsheet created");
        onOpenChange(false);
        router.push(`/sheets/${id}`);
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">New spreadsheet</DialogTitle>
          <DialogDescription>It&apos;s created in your Google Drive and opens here right away.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Q4 Outreach"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && title.trim() && create.mutate({ title })}
        />
        <DialogFooter>
          <Button onClick={() => create.mutate({ title })} disabled={!title.trim() || create.isPending}>
            {create.isPending && <Spinner />}
            Create spreadsheet
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
