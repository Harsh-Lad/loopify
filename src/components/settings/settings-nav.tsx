"use client";

import { IconPlugConnected, IconUser, IconUsers } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/settings", label: "Profile", icon: IconUser },
  { href: "/settings/members", label: "People", icon: IconUsers },
  { href: "/settings/connectors", label: "Connectors", icon: IconPlugConnected },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex gap-1 border-b" aria-label="Settings">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
