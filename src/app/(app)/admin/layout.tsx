import { Suspense, type ReactNode } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { PageBody, PageHeader } from "@/components/common/page-header";

/** Each page gates itself with AdminGate, so the layout can render its children on the server. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PageBody>
      <PageHeader
        title="Platform admin"
        description="Every organization and person on Loopify, in one place. Changes here apply across tenants."
      />
      <Suspense fallback={<div className="mt-6 h-10 border-b" />}>
        <AdminNav />
      </Suspense>
      <div className="mt-6">{children}</div>
    </PageBody>
  );
}
