import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/game/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// Read from the one constant rather than written out again here, the same
// rule every other screen follows. The title used to spell out an older,
// longer name, so the browser tab and the game's own masthead disagreed
// about what this build is called. The authors field went with it: it
// named a studio that does not exist, and nothing in the app reads it.
export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "A multiplayer maritime trade game on the ancient Silk Road. Captains gather in a shared harbor, sail in lockstep, and the highest Reputation wins the Sea Master crown.",
  keywords: [APP_NAME, "Silk Road", "trading game", "multiplayer", "maritime"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
