"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Notion-style editor: markdown shortcuts (#, -, 1., >, `code`) work out of the box.
 * Calls onChange with both the document and its plain text, debounced.
 */
export function RichEditor({
  value,
  onChange,
  placeholder,
  className,
  debounceMs = 800,
  editable = true,
}: {
  value: JSONContent | null | undefined;
  onChange?: (doc: JSONContent, text: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
  editable?: boolean;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Placeholder.configure({ placeholder: placeholder ?? "Write something..." }),
    ],
    content: value ?? undefined,
    editorProps: { attributes: { class: cn("loopify-prose min-h-32 text-sm", className) } },
    onUpdate: ({ editor }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => latest.current?.(editor.getJSON(), editor.getText()), debounceMs);
    },
  });

  // Flush a pending save when the editor unmounts.
  useEffect(
    () => () => {
      if (timer.current && editor) {
        clearTimeout(timer.current);
        latest.current?.(editor.getJSON(), editor.getText());
      }
    },
    [editor],
  );

  return <EditorContent editor={editor} />;
}
