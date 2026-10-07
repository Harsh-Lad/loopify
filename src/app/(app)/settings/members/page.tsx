import type { Metadata } from "next";
import { MembersSettings } from "@/components/settings/members-settings";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "People" };

export default function MembersPage() {
  return (
    <ClientView>
      <MembersSettings />
    </ClientView>
  );
}
