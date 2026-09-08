"use client";

import { ThemeProvider } from "next-themes";
import { type ReactNode } from "react";

import { ServiceWorkerRegistration } from "@/components/layouts/pwa";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster position="top-center" />
      <ServiceWorkerRegistration />
    </ThemeProvider>
  );
}
