"use client";

import { IconCheck, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { PriorityIcon } from "@/components/common/priority";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";

type Suggestion = RouterOutputs["capture"]["get"]["suggestions"][number];
type Board = RouterOutputs["board"]["list"][number];

export function SuggestionCard({
  suggestion,
  captureId,
  boards,
  members,
}: {
  suggestion: Suggestion;
  captureId: string;
  boards: Board[];
  members: { id: string; name: string }[];
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(suggestion.title);
  const [boardId, setBoardId] = useState(suggestion.suggestedBoardId ?? boards[0]?.id ?? "");
  const [assigneeId, setAssigneeId] = useState<string>(suggestion.suggestedUserId ?? "me");
  const [planToday, setPlanToday] = useState(true);
  const me = useQuery(trpc.me.get.queryOptions());
  const forMe = assigneeId === "me" || assigneeId === me.data?.id;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.capture.get.queryKey({ captureId }) });
    void queryClient.invalidateQueries({ queryKey: trpc.capture.list.queryKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.day.today.queryKey() });
  };

  const accept = useMutation(
    trpc.capture.accept.mutationOptions({
      onSuccess: ({ key }) => {
        toast.success(`Created ${key}`, { description: planToday && forMe ? "Added to your day too." : undefined });
        refresh();
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const dismiss = useMutation(
    trpc.capture.dismiss.mutationOptions({ onSuccess: refresh, onError: (e) => toast.error(errorMessage(e)) }),
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="rounded-2xl border bg-card p-4 shadow-xs"
    >
      <div className="flex items-start gap-2">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Card title"
          className="h-9 flex-1 font-medium"
        />
        <PriorityIcon priority={suggestion.priority} className="mt-2.5" />
      </div>
      {suggestion.description && <p className="mt-2 text-sm text-muted-foreground">{suggestion.description}</p>}
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {suggestion.dueDate && <span>Due {format(suggestion.dueDate, "EEE d MMM")}</span>}
        {suggestion.assigneeHint && !suggestion.suggestedUserId && <span>Mentioned: {suggestion.assigneeHint}</span>}
        <span>{Math.round(suggestion.confidence * 100)}% sure</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Select value={boardId} onValueChange={setBoardId}>
          <SelectTrigger size="sm" className="w-full" aria-label="Board">
            <SelectValue placeholder="Pick a board" />
          </SelectTrigger>
          <SelectContent>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assigneeId} onValueChange={setAssigneeId}>
          <SelectTrigger size="sm" className="w-full" aria-label="Assignee">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="me">Me</SelectItem>
            <SelectItem value="none">Nobody yet</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id={`today-${suggestion.id}`}
            checked={planToday && forMe}
            onCheckedChange={setPlanToday}
            disabled={!forMe}
          />
          <Label htmlFor={`today-${suggestion.id}`} className="text-sm font-normal">
            Add to my day
          </Label>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => dismiss.mutate({ suggestionId: suggestion.id })}
            disabled={dismiss.isPending}
          >
            <IconX />
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() =>
              accept.mutate({
                suggestionId: suggestion.id,
                boardId,
                title: title.trim() || undefined,
                assigneeId: assigneeId === "me" ? (me.data?.id ?? null) : assigneeId === "none" ? null : assigneeId,
                planToday: planToday && forMe,
              })
            }
            disabled={!boardId || accept.isPending}
          >
            <IconCheck />
            Create card
          </Button>
        </div>
      </div>
    </motion.article>
  );
}
