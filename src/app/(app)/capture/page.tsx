import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureView } from "@/components/capture/capture-view";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Capture" };

export default function CapturePage() {
  return (
    <Suspense>
      <ClientView>
        <CaptureView />
      </ClientView>
    </Suspense>
  );
}
