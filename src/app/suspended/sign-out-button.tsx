"use client";

import { IconLogout } from "@tabler/icons-react";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="lg"
      className="h-11 px-6"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut({ redirectTo: "/sign-in" });
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : <IconLogout data-icon="inline-start" />}
      Sign out
    </Button>
  );
}
