"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { BoardSkeleton } from "@/components/board/board-view";
import { errorMessage, useTRPC } from "@/lib/trpc/client";

/** Finds (or creates, on first visit) your personal board, then opens it. */
export function OpenMyBoard() {
  const trpc = useTRPC();
  const router = useRouter();
  const open = useMutation(
    trpc.board.personal.mutationOptions({ onSuccess: ({ id }) => router.replace(`/boards/${id}`) }),
  );
  const { mutate } = open;
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    mutate();
  }, [mutate]);

  if (open.isError) {
    return <p className="p-10 text-center text-muted-foreground">{errorMessage(open.error)}</p>;
  }
  return <BoardSkeleton />;
}
