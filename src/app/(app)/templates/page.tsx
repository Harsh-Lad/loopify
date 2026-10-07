import type { Metadata } from "next";
import { TemplatesView } from "@/components/templates/templates-view";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Workflows" };

export default function TemplatesPage() {
  return (
    <ClientView>
      <TemplatesView />
    </ClientView>
  );
}
