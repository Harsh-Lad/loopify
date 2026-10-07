import type { Metadata } from "next";
import { ClientView } from "@/components/common/client-view";
import { OpenMyBoard } from "@/components/board/open-my-board";

export const metadata: Metadata = { title: "My board" };

export default function MyBoardPage() {
  return (
    <ClientView>
      <OpenMyBoard />
    </ClientView>
  );
}
