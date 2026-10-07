"use client";

import { IconCheck, IconLoader2, IconMoonStars, IconNotebook, IconRefresh } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { RichEditor } from "@/components/common/rich-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { celebrateBig } from "@/lib/celebrate";
import { errorMessage, useTRPC, type RouterOutputs } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

type Plan = RouterOutputs["day"]["today"]["plan"];

const MOODS = [
  { value: "tired", emoji: "😴", label: "Tired" },
  { value: "meh", emoji: "😐", label: "Meh" },
  { value: "good", emoji: "🙂", label: "Good" },
  { value: "great", emoji: "😄", label: "Great" },
  { value: "fire", emoji: "🔥", label: "On fire" },
];

/** The diary side of the day: mood, free notes, and the end-of-day shutdown. */
export function DiaryPanel({ plan, done, total }: { plan: Plan; done: number; total: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: trpc.day.today.queryKey() });
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const saveNote = useMutation(
    trpc.day.saveNote.mutationOptions({
      onMutate: () => setSaveState("saving"),
      onSuccess: () => setSaveState("saved"),
      onError: (e) => {
        setSaveState("idle");
        toast.error(errorMessage(e, "Couldn't save your notes"));
      },
    }),
  );
  const setMood = useMutation(trpc.day.setMood.mutationOptions({ onSuccess: invalidate }));
  const close = useMutation(
    trpc.day.close.mutationOptions({
      onSuccess: async () => {
        celebrateBig();
        toast.success("Day closed. Your summary is being written.");
        await invalidate();
        setTimeout(invalidate, 4000);
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const reopen = useMutation(trpc.day.reopen.mutationOptions({ onSuccess: invalidate }));

  const closed = Boolean(plan.closedAt);

  return (
    <div className="space-y-4">
      <Card className="gap-4">
        <CardHeader className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <IconNotebook className="size-5 text-brand" />
            Diary
          </CardTitle>
          <span className="flex items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
            {saveState === "saving" && <IconLoader2 className="size-3.5 animate-spin" />}
            {saveState === "saved" && <IconCheck className="size-3.5 text-success" />}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : ""}
          </span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm text-muted-foreground">How&apos;s today feeling?</p>
            <ToggleGroup
              type="single"
              value={plan.mood ?? ""}
              onValueChange={(mood) => setMood.mutate({ planId: plan.id, mood: mood || null })}
              className="w-full justify-between"
            >
              {MOODS.map((mood) => (
                <ToggleGroupItem
                  key={mood.value}
                  value={mood.value}
                  aria-label={mood.label}
                  className="flex-1 text-xl data-[state=on]:bg-highlight/30"
                >
                  <motion.span whileHover={{ scale: 1.25, rotate: -8 }} whileTap={{ scale: 0.85 }}>
                    {mood.emoji}
                  </motion.span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="rounded-xl bg-muted/50 p-3">
            <RichEditor
              value={plan.note as JSONContent | null}
              placeholder="Who did you talk to? What did you decide? Anything you want to remember tomorrow..."
              onChange={(note, noteText) => saveNote.mutate({ planId: plan.id, note: note as never, noteText })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className={cn("gap-3 transition-colors", closed && "border-success/50 bg-success/5")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-lg">
            <IconMoonStars className="size-5 text-brand" />
            {closed ? "Day closed" : "Wrap up the day"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {closed ? (
            plan.summary ? (
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{plan.summary}</pre>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconLoader2 className="size-4 animate-spin" /> Writing your summary...
              </p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {total ? `${done} of ${total} done.` : "Nothing planned today."} Closing the day writes a short standup of
              what you did and what&apos;s left.
            </p>
          )}
          {closed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reopen.mutate({ planId: plan.id })}
              disabled={reopen.isPending}
            >
              <IconRefresh />
              Reopen the day
            </Button>
          ) : (
            <Button className="w-full" onClick={() => close.mutate({ planId: plan.id })} disabled={close.isPending}>
              <IconMoonStars />
              Close the day
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
