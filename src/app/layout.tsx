import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { requestLocale } from "@/lib/api-auth";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/game/constants/brand";
import { tFor } from "@/lib/game/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_SC({
  variable: "--font-display-family",
  subsets: ["latin"],
  weight: ["500", "700"],
});

// What a link preview needs an absolute address for. There is no
// canonical domain here: the game runs on whatever machine serves it,
// most often a laptop on a network, so the fallback is the port the
// server has always answered on. APP_URL pins the address of a hosted
// deployment, and Railway names the service's own address in its variable
// (the same one next.config.ts reads for the development origin), so a
// deployment on either host resolves its real address with nothing else
// to configure.
const APP_URL = process.env.APP_URL?.trim().replace(/\/+$/, "");

// A malformed value is worth stopping for: the alternative is a page that
// renders with preview links pointing somewhere nobody intended, which
// looks like a working site.
function absoluteOrigin(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "APP_URL must be an absolute address with its scheme, for example https://play.example.com.",
    );
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_URL must start with http:// or https://.");
  }
  return url;
}

const SITE_URL = APP_URL
  ? absoluteOrigin(APP_URL)
  : new URL(
      process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : "http://localhost:8080",
    );

// Read from the one constant rather than written out again here, the same
// rule every other screen follows, so the browser tab and the game's own
// masthead can never disagree about what this build is called. The authors
// field stays undeclared: it would name a studio that does not exist, and
// nothing in the app reads it. The social fields carry the card built
// beside this file, which is why the two of them are named here rather
// than described twice.
//
// The sentence a search engine reads (the description) and the two words
// beside it are read in the captain's language, which is why this is a
// function rather than a constant: metadata is built per request, from
// the same cookie the socket's handshake reads, and the English a captain
// sees today is what the read answers back when the cookie says English
// or says nothing. The line itself is the pack's frame with the build's
// own name filled in, because the name is a name and never translates.
//
// The link preview and the social card carry the sentence WITHOUT the
// name, which is the plain APP_DESCRIPTION they have always carried, so
// the pack stores that unnamed spelling as its own row beside the named
// one (shell.001 and shell.021). Both fields read it in the captain's
// language, the same way the search description does, so a shared link
// unfolds in the language its captain reads rather than in the build's
// default.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await requestLocale();
  // The meta description, with the build's own name in front. The social
  // fields below carry the same sentence without the name.
  const about = tFor(
    locale,
    "{APP_NAME}: A multiplayer maritime trade game on the ancient Silk Road. Captains gather in a shared harbor, sail in lockstep, and the highest Reputation wins the Sea Master crown.",
    { APP_NAME },
  );
  const social = tFor(locale, APP_DESCRIPTION);
  return {
    metadataBase: SITE_URL,
    title: APP_NAME,
    description: about,
    keywords: [
      APP_NAME,
      tFor(locale, "Silk Road"),
      tFor(locale, "trading game"),
      "multiplayer",
      "maritime",
    ],
    openGraph: {
      type: "website",
      siteName: APP_NAME,
      title: APP_NAME,
      description: social,
    },
    twitter: {
      card: "summary_large_image",
      title: APP_NAME,
      description: social,
    },
  };
}

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

// The language this request's captain reads, off the pm_locale cookie the
// client keeps in step with the pick and the realtime layer reads at its
// handshake. The shell is the one screen with no provider above it (it
// renders them), so the cookie is the only reading it can make, and the
// shipped language stands wherever the cookie is absent or names a
// language this pack cannot print.
//
// The reading itself is the shared one (see requestLocale in
// @/lib/api-auth), which is where every route reads the same cookie the
// same way. The shell used to read it a second time, here, and two
// readers of one cookie are two places for the fallback to drift.

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The document's own language, for a screen reader, a search engine and
  // the browser's font fallback, follows the same cookie the words do:
  // "en" is what it has always been for an English captain.
  const locale = await requestLocale();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
