"use client";

import { IconBuildingSkyscraper, IconLayoutDashboard, IconUsers } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview", icon: IconLayoutDashboard },
  { href: "/admin/orgs", label: "Organizations", icon: IconBuildingSkyscraper },
  { href: "/admin/users", label: "Users", icon: IconUsers },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-6 flex gap-1 border-b" aria-label="Platform admin">
      {LINKS.map((link) => {
        const active = link.href === "/admin" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
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
