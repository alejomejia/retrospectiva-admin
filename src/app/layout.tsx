import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { caveat, dmMono, dmSans } from '@/lib/styles/fonts';
import "@/lib/styles/globals.css";
import { cn } from "@/lib/utils/helpers";

export const metadata: Metadata = {
  title: "Retrospectiva — Admin",
  description: "Panel interno de Retrospectiva - tienda de ropa vintage.",
  // Private admin — never index. Mirrors the X-Robots-Tag header and robots.ts.
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={cn(dmSans.variable, dmMono.variable, caveat.variable, 'brand-paper h-full antialiased')}
    >
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
