import type { Metadata } from "next";
import { ClientView } from "@/components/common/client-view";
import { DashboardView } from "@/components/insights/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <ClientView>
      <DashboardView />
    </ClientView>
  );
}
