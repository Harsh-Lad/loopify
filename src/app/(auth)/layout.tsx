import type { ReactNode } from "react";
import { AuthShowcase } from "@/components/auth/auth-showcase";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">Plan it. Do it. Loop the rest into tomorrow.</p>
      </div>
      <AuthShowcase />
    </div>
  );
}
