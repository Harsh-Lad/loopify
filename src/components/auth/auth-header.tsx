import type { ReactNode } from "react";

export function AuthHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      {children && <p className="mt-2 text-sm text-muted-foreground text-pretty">{children}</p>}
    </div>
  );
}
