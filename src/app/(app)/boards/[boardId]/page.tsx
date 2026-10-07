import { Suspense } from "react";
import { BoardSkeleton, BoardView } from "@/components/board/board-view";
import { ClientView } from "@/components/common/client-view";

export default function BoardPage({ params }: PageProps<"/boards/[boardId]">) {
  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardLoader params={params} />
    </Suspense>
  );
}

async function BoardLoader({ params }: { params: PageProps<"/boards/[boardId]">["params"] }) {
  const { boardId } = await params;
  return (
    <ClientView>
      <BoardView boardId={boardId} />
    </ClientView>
  );
}
