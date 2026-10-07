import type { Metadata } from "next";
import { Suspense } from "react";
import { ConnectorsSettings } from "@/components/settings/connectors-settings";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Connectors" };

export default function ConnectorsPage() {
  return (
    <Suspense>
      <ClientView>
        <ConnectorsSettings />
      </ClientView>
    </Suspense>
  );
}
