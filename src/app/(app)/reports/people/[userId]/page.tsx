import type { Metadata } from "next";
import { Suspense } from "react";
import { ClientView } from "@/components/common/client-view";
import { InsightsSkeleton } from "@/components/insights/insights-board";
import { PersonReportView } from "@/components/insights/person-report-view";

export const metadata: Metadata = { title: "Person report" };

export default function PersonReportPage({ params }: PageProps<"/reports/people/[userId]">) {
  return (
    <Suspense fallback={<div className="p-6"><InsightsSkeleton /></div>}>
      <PersonLoader params={params} />
    </Suspense>
  );
}

async function PersonLoader({ params }: { params: PageProps<"/reports/people/[userId]">["params"] }) {
  const { userId } = await params;
  return (
    <ClientView>
      <PersonReportView userId={userId} />
    </ClientView>
  );
}
