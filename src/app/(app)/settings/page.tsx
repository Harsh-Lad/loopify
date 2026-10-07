import type { Metadata } from "next";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { ClientView } from "@/components/common/client-view";

export const metadata: Metadata = { title: "Profile" };

export default function SettingsPage() {
  return (
    <ClientView>
      <ProfileSettings />
    </ClientView>
  );
}
