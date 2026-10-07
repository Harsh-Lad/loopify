import type { Metadata } from "next";
import { ClientView } from "@/components/common/client-view";
import { PageBody, PageHeader } from "@/components/common/page-header";
import { CalendarView } from "@/components/insights/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <PageBody className="max-w-7xl">
      <PageHeader
        title="Calendar"
        description="What's due, what got done and how each day's plan went."
        className="mb-6"
      />
      <ClientView>
        <CalendarView />
      </ClientView>
    </PageBody>
  );
}
