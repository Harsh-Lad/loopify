import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientView } from "@/components/common/client-view";
import { SheetsHome } from "@/components/sheets/sheets-home";

export const metadata: Metadata = { title: "Sheets" };

export default function SheetsPage() {
  return (
    <Suspense>
      <ClientView>
        <SheetsHome />
      </ClientView>
    </Suspense>
  );
}
