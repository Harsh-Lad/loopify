import type { Metadata } from "next";
import { Suspense } from "react";
import { AcceptInvite } from "@/components/onboarding/accept-invite";

export const metadata: Metadata = { title: "Join" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense>
      <InviteLoader params={params} />
    </Suspense>
  );
}

async function InviteLoader({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params;
  return <AcceptInvite token={token} />;
}
