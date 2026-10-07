"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Renders assistant replies: tables, lists, bold and links, styled to sit inside a chat bubble. */
export function ChatMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "space-y-2 text-sm leading-relaxed",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_strong]:font-semibold [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs",
        "[&_h1]:font-heading [&_h1]:text-base [&_h1]:font-bold [&_h2]:font-heading [&_h2]:font-bold [&_h3]:font-semibold",
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-medium break-all text-brand underline underline-offset-2"
            >
              {label}
            </a>
          ),
          table: ({ children: rows }) => (
            <div className="my-1 max-w-full overflow-x-auto rounded-xl border bg-background">
              <table className="w-full text-xs">{rows}</table>
            </div>
          ),
          thead: ({ children: head }) => <thead className="bg-muted/70">{head}</thead>,
          th: ({ children: cell }) => (
            <th className="border-b px-2.5 py-1.5 text-left font-semibold whitespace-nowrap">{cell}</th>
          ),
          td: ({ children: cell }) => (
            <td className="border-b px-2.5 py-1.5 whitespace-nowrap [tr:last-child_&]:border-0">{cell}</td>
          ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
