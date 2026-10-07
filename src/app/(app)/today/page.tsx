import type { Metadata } from "next";
import { TodayView } from "@/components/today/today-view";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <ClientView>
      <TodayView />
    </ClientView>
  );
}
