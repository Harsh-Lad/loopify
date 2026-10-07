import type { Metadata } from "next";
import { ReportsView } from "@/components/reports/reports-view";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <ClientView>
      <ReportsView />
    </ClientView>
  );
}
