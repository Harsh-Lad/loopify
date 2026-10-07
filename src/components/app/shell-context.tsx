"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

export type CaptureTab = "write" | "record" | "upload" | "drive";

type ShellState = {
  captureOpen: boolean;
  setCaptureOpen: (open: boolean) => void;
  /** Which way in the capture dialog opens on. */
  captureTab: CaptureTab;
  openCapture: (tab?: CaptureTab) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  inviteOpen: boolean;
  setInviteOpen: (open: boolean) => void;
};

const ShellContext = createContext<ShellState | null>(null);

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return Boolean(el?.closest("input, textarea, select, [contenteditable=true], [role=textbox], [role=grid]"));
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureTab, setCaptureTab] = useState<CaptureTab>("write");
  const openCapture = useCallback((tab: CaptureTab = "write") => {
    setCaptureTab(tab);
    setCaptureOpen(true);
  }, []);
  const [commandOpen, setCommandOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((open) => !open);
        return;
      }
      if (
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        event.key.toLowerCase() === "c" &&
        !isTyping(event.target)
      ) {
        event.preventDefault();
        openCapture();
      }
    },
    [openCapture],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  const value = useMemo(
    () => ({
      captureOpen,
      setCaptureOpen,
      captureTab,
      openCapture,
      commandOpen,
      setCommandOpen,
      inviteOpen,
      setInviteOpen,
    }),
    [captureOpen, captureTab, openCapture, commandOpen, inviteOpen],
  );
  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell() {
  const value = use(ShellContext);
  if (!value) throw new Error("useShell must be used inside ShellProvider");
  return value;
}
