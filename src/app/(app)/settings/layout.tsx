import { Suspense, type ReactNode } from "react";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <PageBody className="max-w-4xl">
      <PageHeader title="Settings" />
      <Suspense fallback={<div className="mt-6 h-10 border-b" />}>
        <SettingsNav />
      </Suspense>
      <div className="mt-6">{children}</div>
    </PageBody>
  );
}
