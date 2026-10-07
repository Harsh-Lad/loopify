import type { Metadata } from "next";
import { CreateOrgForm } from "@/components/onboarding/create-org-form";

export const metadata: Metadata = { title: "Set up" };

export default function OnboardingPage() {
  return <CreateOrgForm />;
}
