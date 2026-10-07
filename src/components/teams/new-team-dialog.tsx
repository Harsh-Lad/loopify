"use client";

import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DynamicIcon, ICONS } from "@/components/app/dynamic-icon";
import { TemplatePicker } from "@/components/common/template-picker";
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
import { Spinner } from "@/components/ui/spinner";
import { errorMessage, useTRPC } from "@/lib/trpc/client";
import { COLUMN_COLORS } from "@/lib/workflow-presets";
import { cn } from "@/lib/utils";

export function NewTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("users");
  const [color, setColor] = useState<string>("blue");
  const [templateId, setTemplateId] = useState("tpl_general");

  const create = useMutation(
    trpc.team.create.mutationOptions({
      onSuccess: async ({ team, boardId }) => {
        await queryClient.invalidateQueries({ queryKey: trpc.team.list.queryKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.board.list.queryKey() });
        toast.success(`${team.name} is ready`);
        onOpenChange(false);
        setName("");
        router.push(`/boards/${boardId}`);
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">New team</DialogTitle>
          <DialogDescription>Each team gets its own board, starting from the workflow you pick.</DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field data-invalid={create.isError || undefined}>
            <FieldLabel htmlFor="team-name">Team name</FieldLabel>
            <Input
              id="team-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Influencer marketing"
            />
            <FieldError>{create.error ? errorMessage(create.error) : null}</FieldError>
          </Field>
          <Field>
            <FieldLabel>Look</FieldLabel>
            <div className="flex flex-wrap items-center gap-1.5">
              {Object.keys(ICONS).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  onClick={() => setIcon(key)}
                  className={cn(
                    "grid size-9 place-items-center rounded-lg border transition-transform hover:scale-105",
                    icon === key && "border-primary bg-primary/10 text-brand",
                  )}
                >
                  <DynamicIcon name={key} className="size-4.5" />
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLUMN_COLORS.filter((c) => c !== "slate").map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full transition-transform hover:scale-110",
                    `tint-${c}`,
                    color === c && "ring-2 ring-ring ring-offset-2 ring-offset-background",
                  )}
                  style={{ background: "var(--tint)" }}
                />
              ))}
            </div>
          </Field>
          <Field>
            <FieldLabel>Workflow</FieldLabel>
            <TemplatePicker value={templateId} onChange={setTemplateId} />
          </Field>
        </FieldGroup>
        <DialogFooter>
          <Button
            onClick={() => create.mutate({ name, icon, color, templateId })}
            disabled={name.trim().length < 2 || create.isPending}
          >
            {create.isPending ? <Spinner /> : <IconPlus />}
            Create team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
