import { Suspense } from "react";
import { TeamDetail } from "@/components/teams/team-detail";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientView } from "@/components/common/client-view";

export default function TeamPage({ params }: PageProps<"/teams/[teamId]">) {
  return (
    <Suspense fallback={<Skeleton className="m-6 h-96 rounded-2xl" />}>
      <TeamLoader params={params} />
    </Suspense>
  );
}

async function TeamLoader({ params }: { params: PageProps<"/teams/[teamId]">["params"] }) {
  const { teamId } = await params;
  return (
    <ClientView>
      <TeamDetail teamId={teamId} />
    </ClientView>
  );
}
