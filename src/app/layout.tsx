import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/game/constants/brand";

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

// What a link preview needs an absolute address for. There is no
// canonical domain here: the game runs on whatever machine serves it,
// most often a laptop on a network, so the fallback is the port the
// server has always answered on. Railway, the one host this tree
// documents, names the service's own address in its variable (the same
// one next.config.ts reads for the development origin), so a deployment
// resolves its real address with nothing to configure.
const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : "http://localhost:8080";

// Read from the one constant rather than written out again here, the same
// rule every other screen follows, so the browser tab and the game's own
// masthead can never disagree about what this build is called. The authors
// field stays undeclared: it would name a studio that does not exist, and
// nothing in the app reads it. The social fields carry the card built
// beside this file, which is why the two of them are named here rather
// than described twice.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: APP_NAME,
  description: `${APP_NAME}: ${APP_DESCRIPTION}`,
  keywords: [APP_NAME, "Silk Road", "trading game", "multiplayer", "maritime"],
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: APP_NAME,
    description: APP_DESCRIPTION,
  },
};

// The color the browser tints its own furniture with, per scheme, so a
// phone's address bar blends into the page instead of framing it in
// white. The two values are the canvas colors themselves, converted from
// the --background tokens in globals.css, so the chrome and the page
// read as one surface rather than two.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfaf4" },
    { media: "(prefers-color-scheme: dark)", color: "#091018" },
  ],
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
