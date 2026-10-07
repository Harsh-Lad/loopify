import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/admin-overview";
import { AdminGate } from "@/components/admin/admin-shared";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Platform admin" };

export default function AdminOverviewPage() {
  return (
    <ClientView>
      <AdminGate>
        <AdminOverview />
      </AdminGate>
    </ClientView>
  );
}
