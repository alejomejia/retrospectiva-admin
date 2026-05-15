import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";
import { caveat, dmMono, dmSans } from '@/lib/styles/fonts';
import "@/lib/styles/globals.css";
import { cn } from "@/lib/utils/helpers";

export const metadata: Metadata = {
  title: "Retrospectiva — Admin",
  description: "Panel interno de Retrospectiva - tienda de ropa vintage.",
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
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
