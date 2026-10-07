import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientView } from "@/components/common/client-view";
import { SheetWorkspace } from "@/components/sheets/sheet-workspace";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Sheet" };

export default function SpreadsheetPage({ params }: PageProps<"/sheets/[spreadsheetId]">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-[70svh] rounded-2xl" />}>
      <SpreadsheetLoader params={params} />
    </Suspense>
  );
}

async function SpreadsheetLoader({ params }: { params: PageProps<"/sheets/[spreadsheetId]">["params"] }) {
  const { spreadsheetId } = await params;
  return (
    <ClientView>
      <SheetWorkspace spreadsheetId={spreadsheetId} />
    </ClientView>
  );
}
