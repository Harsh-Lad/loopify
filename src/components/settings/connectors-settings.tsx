"use client";

import {
  IconBrandGmail,
  IconBrandGoogle,
  IconBrandGoogleDrive,
  IconDeviceMobile,
  IconSparkles,
  IconTable,
  IconVideo,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";

const GOOGLE_MESSAGES: Record<string, string> = {
  connected: "Google connected. Sheets chat and Drive imports are ready.",
  denied: "Google access was cancelled.",
  expired: "That took too long. Try connecting again.",
  mismatch: "You were signed in as someone else. Try again.",
  failed: "Google didn't accept the connection. Check the client ID and redirect URI.",
  not_configured: "Google isn't set up on the server yet.",
};

export function ConnectorsSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const params = useSearchParams();
  const data = useQuery(trpc.integration.list.queryOptions());
  const disconnect = useMutation(
    trpc.integration.disconnect.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.integration.list.queryKey() });
        toast("Google disconnected");
      },
    }),
  );

  useEffect(() => {
    const status = params.get("google");
    if (status && GOOGLE_MESSAGES[status]) {
      (status === "connected" ? toast.success : toast.error)(GOOGLE_MESSAGES[status]);
    }
  }, [params]);

  if (!data.data) return <Skeleton className="h-64 rounded-2xl" />;
  const google = data.data.google;

  return (
    <div className="space-y-3">
      <Item variant="outline" className="rounded-2xl">
        <ItemMedia variant="icon">
          <IconBrandGoogle />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            Google Sheets and Drive
            {google.connection && <Badge variant="success">Connected</Badge>}
          </ItemTitle>
          <ItemDescription>
            {google.connection
              ? `Connected as ${google.connection.accountEmail ?? "your Google account"}.`
              : "Chat with your spreadsheets, and import Google Meet transcripts, Docs and Sheets into Capture."}
          </ItemDescription>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary">
              <IconTable /> Sheets chat
            </Badge>
            <Badge variant="secondary">
              <IconVideo /> Meet transcripts → Capture
            </Badge>
            <Badge variant="secondary">
              <IconBrandGoogleDrive /> Docs and Sheets → Capture
            </Badge>
          </div>
        </ItemContent>
        <ItemActions>
          {!google.configured ? (
            <Badge variant="outline">Needs server setup</Badge>
          ) : google.connection ? (
            <Button variant="outline" size="sm" onClick={() => disconnect.mutate({ provider: "GOOGLE" })}>
              Disconnect
            </Button>
          ) : (
            <Button size="sm" asChild>
              <a href="/api/integrations/google/connect">Connect</a>
            </Button>
          )}
        </ItemActions>
      </Item>

      <Item variant="outline" className="rounded-2xl">
        <ItemMedia variant="icon">
          <IconSparkles />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            AI model
            {data.data.ai.configured ? (
              <Badge variant="success">Ready</Badge>
            ) : (
              <Badge variant="outline">Not set</Badge>
            )}
          </ItemTitle>
          <ItemDescription>
            Powers capture, daily summaries and Sheets chat. Configured on the server with AI_API_KEY.
          </ItemDescription>
        </ItemContent>
      </Item>

      <Item variant="outline" className="rounded-2xl">
        <ItemMedia variant="icon">
          <IconDeviceMobile />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>
            Mobile app <Badge variant="success">Available</Badge>
          </ItemTitle>
          <ItemDescription>
            Record a conversation on your phone (or a Plaud recorder) and its action items land in Capture. Sign in with
            this same account.
          </ItemDescription>
        </ItemContent>
      </Item>

      <h2 className="pt-4 text-sm font-semibold text-muted-foreground">Coming next</h2>
      {[
        { icon: IconBrandGmail, title: "Gmail", text: "Turn emails into cards and pull action items from threads." },
        {
          icon: IconVideo,
          title: "Meeting bot",
          text: "Joins Meet, Zoom or Teams calls live and sends action items to Capture as you talk.",
        },
        {
          icon: IconBrandGoogleDrive,
          title: "Drive attachments",
          text: "Attach docs to cards without leaving Loopify.",
        },
      ].map((c) => (
        <Item key={c.title} variant="muted" className="rounded-2xl opacity-80">
          <ItemMedia variant="icon">
            <c.icon />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{c.title}</ItemTitle>
            <ItemDescription>{c.text}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  );
}
