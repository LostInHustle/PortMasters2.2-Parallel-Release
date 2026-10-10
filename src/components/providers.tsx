"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "framer-motion";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

// One setting governs every animation in the tree: a captain whose system
// asks for reduced motion gets it, from the panels that rise and settle
// to the rows that lift under the cursor. That is what reducedMotion
// "user" means, and it is the only honest default here, because the
// system preference is a medical and comfort setting rather than a taste,
// and a game that animates through it is a game some people cannot play.
// It sits above everything animated rather than on any one surface, so a
// component added later is covered without its author knowing to opt in.
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <MotionConfig reducedMotion="user">
        <TooltipProvider delayDuration={200} skipDelayDuration={300}>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
