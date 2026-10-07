"use client";

import { IconFilePlus, IconTable } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

type Cell = string | number | boolean | null;

/** Sends picked rows to the end of another sheet's tab, or into a brand new spreadsheet. */
export function SendRowsDialog({
  open,
  onOpenChange,
  rows,
  header,
  headerIncluded,
  sourceTitle,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: Cell[][];
  header: Cell[];
  headerIncluded: boolean;
  sourceTitle: string;
  onSent: () => void;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim());
  const [targetId, setTargetId] = useState<string | null>(null);
  const [targetTab, setTargetTab] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState(`${sourceTitle} (selection)`);
  const [withHeader, setWithHeader] = useState(true);

  const files = useQuery({
    ...trpc.sheets.browse.queryOptions({ query: deferred || undefined }),
    enabled: open && mode === "existing",
    placeholderData: (prev) => prev,
  });
  const target = useQuery({
    ...trpc.sheets.spreadsheet.queryOptions({ spreadsheetId: targetId ?? "" }),
    enabled: Boolean(targetId),
  });
  const tab = targetTab ?? target.data?.tabs[0]?.title ?? null;

  const send = useMutation(
    trpc.sheets.sendRows.mutationOptions({
      onSuccess: (res) => {
        onOpenChange(false);
        onSent();
        toast.success(`Sent ${res.rows} ${res.rows === 1 ? "row" : "rows"}`, {
          action: { label: "Open", onClick: () => router.push(`/sheets/${res.spreadsheetId}`) },
        });
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  const submit = () => {
    if (mode === "new") {
      send.mutate({
        rows,
        header: withHeader && !headerIncluded ? header : undefined,
        target: { kind: "new", title: newTitle },
      });
    } else if (targetId && tab) {
      send.mutate({ rows, target: { kind: "existing", spreadsheetId: targetId, tab } });
    }
  };

  const ready = mode === "new" ? newTitle.trim().length > 0 : Boolean(targetId && tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            Send {rows.length} {rows.length === 1 ? "row" : "rows"}
          </DialogTitle>
          <DialogDescription>Copies the rows. The originals stay where they are.</DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "existing" | "new")}>
          <TabsList className="w-full">
            <TabsTrigger value="existing">
              <IconTable /> Another sheet
            </TabsTrigger>
            <TabsTrigger value="new">
              <IconFilePlus /> New spreadsheet
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-3 pt-3">
            <Command shouldFilter={false} className="rounded-xl border">
              <CommandInput placeholder="Search your sheets" value={query} onValueChange={setQuery} />
              <CommandList className="max-h-56">
                <CommandEmpty>{files.isFetching ? "Looking..." : "No sheets found."}</CommandEmpty>
                <CommandGroup>
                  {files.data?.files.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={f.id}
                      onSelect={() => {
                        setTargetId(f.id);
                        setTargetTab(null);
                      }}
                      data-checked={targetId === f.id}
                      className="data-[checked=true]:bg-accent"
                    >
                      <IconTable className="text-success" />
                      <span className="truncate">{f.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
            {targetId && (
              <Field>
                <FieldLabel>Add to the end of tab</FieldLabel>
                <Select value={tab ?? undefined} onValueChange={setTargetTab} disabled={!target.data}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={target.isLoading ? "Loading tabs..." : "Pick a tab"} />
                  </SelectTrigger>
                  <SelectContent>
                    {target.data?.tabs.map((t) => (
                      <SelectItem key={t.sheetId} value={t.title}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </TabsContent>

          <TabsContent value="new" className="pt-3">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-title">Spreadsheet name</FieldLabel>
                <Input id="new-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </Field>
              {!headerIncluded && header.length > 0 && (
                <div className="flex items-center gap-2">
                  <Checkbox id="with-header" checked={withHeader} onCheckedChange={(v) => setWithHeader(Boolean(v))} />
                  <Label htmlFor="with-header" className="font-normal">
                    Put the header row ({header.slice(0, 3).join(", ")}
                    {header.length > 3 ? "..." : ""}) on top
                  </Label>
                </div>
              )}
            </FieldGroup>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button onClick={submit} disabled={!ready || send.isPending}>
            {send.isPending && <Spinner />}
            Send {rows.length} {rows.length === 1 ? "row" : "rows"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
