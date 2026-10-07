import type { Metadata } from "next";
import { Suspense } from "react";
import { TeamsView } from "@/components/teams/teams-view";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Teams" };

export default function TeamsPage() {
  return (
    <Suspense>
      <ClientView>
        <TeamsView />
      </ClientView>
    </Suspense>
  );
}
