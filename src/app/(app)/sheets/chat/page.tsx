import type { Metadata } from "next";
import { Suspense } from "react";
import { SheetsChat } from "@/components/sheets/sheets-chat";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Sheets chat" };

export default function SheetsPage() {
  return (
    <Suspense>
      <ClientView>
        <SheetsChat />
      </ClientView>
    </Suspense>
  );
}
