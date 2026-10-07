import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Fraunces, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono-face" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["800"], variable: "--font-wordmark-face" });

export const metadata: Metadata = {
  title: { default: "Loopify", template: "%s · Loopify" },
  description: "Your team's daily loop: plan, capture, finish, roll over.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1814" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased font-sans", figtree.variable, bricolage.variable, mono.variable, fraunces.variable)}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
