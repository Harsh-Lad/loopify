import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminOrgs } from "@/components/admin/admin-orgs";
import { AdminGate } from "@/components/admin/admin-shared";
import { ClientView } from "@/components/common/client-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Organizations · Platform admin" };

export default function AdminOrgsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <ClientView>
        <AdminGate>
          <AdminOrgs />
        </AdminGate>
      </ClientView>
    </Suspense>
  );
}
