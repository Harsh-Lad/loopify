"use client";

import { IconLink } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

/** Pull team work onto your personal board, once or automatically. */
export function PersonalBoardTools({ boardId }: { boardId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const prefs = useQuery(trpc.me.personalPrefs.queryOptions());

  const mirrorAll = useMutation(
    trpc.card.mirrorAssigned.mutationOptions({
      onSuccess: ({ mirrored }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.board.get.queryKey({ boardId }) });
        toast.success(
          mirrored
            ? `Mirrored ${mirrored} team ${mirrored === 1 ? "task" : "tasks"}`
            : "Every team task assigned to you is already here",
        );
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );
  const setAuto = useMutation(
    trpc.me.setAutoMirror.mutationOptions({
      onSuccess: ({ autoMirror }) => {
        void queryClient.invalidateQueries({ queryKey: trpc.me.personalPrefs.queryKey() });
        toast(autoMirror ? "New team assignments will appear here" : "Auto-mirror is off");
      },
      onError: (e) => toast.error(errorMessage(e)),
    }),
  );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="outline" onClick={() => mirrorAll.mutate()} disabled={mirrorAll.isPending}>
            {mirrorAll.isPending ? <Spinner /> : <IconLink />}
            Mirror my team tasks
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">
          Brings every open team card assigned to you onto this board. They stay linked: finish one here and it&apos;s
          done on the team board too.
        </TooltipContent>
      </Tooltip>
      <div className="flex items-center gap-2 rounded-full border px-3 py-1">
        <Switch
          id="auto-mirror"
          checked={prefs.data?.autoMirror ?? false}
          disabled={!prefs.data || setAuto.isPending}
          onCheckedChange={(autoMirror) => setAuto.mutate({ autoMirror })}
        />
        <Label htmlFor="auto-mirror" className="text-xs font-normal">
          Auto-mirror new assignments
        </Label>
      </div>
    </>
  );
}
