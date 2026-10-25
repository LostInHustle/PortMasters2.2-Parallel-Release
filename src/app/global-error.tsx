"use client";

import { t } from "@/lib/game/i18n";
import { useLanguage } from "@/lib/use-language-preference";

// The last boundary: the one that catches a throw in the root layout
// itself, which means nothing above it survived, including the layout
// that loads the game's stylesheet. That is why every rule below is an
// inline style rather than a class: a class would be a name with no
// stylesheet behind it, and this screen would render as unstyled text at
// the exact moment the game is least able to explain itself.
//
// The two boundaries above it share one glass card (see ./error-shell),
// and this one cannot join them, because that card is drawn with classes
// and here there is no stylesheet for those classes to mean anything by.
// The words are shared all the same, since both are read out of the same
// language pack.
//
// It carries the same words as the screen-level boundary beside it, so
// the two failures read as one game handling one kind of problem, and
// its only action is a reload, because at this level there is no segment
// left to re-render.
//
// It replaces the root layout, so it sits outside the providers as well:
// the language read below is the fallback reading, which answers in the
// language the process already holds and has no tree above it to redraw.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The words below read through the pack like every other screen's.
  // This boundary replaces the root layout, so it sits outside the
  // providers: useLanguage() answers with the fallback reading, the
  // language the process already holds, and t() prints in that same
  // reading. The attribute and the words therefore always name one
  // language, which on a first-render crash is the shipped one.
  const { locale } = useLanguage();
  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#101521",
          color: "#f2efe6",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: "center",
            padding: 32,
            borderRadius: 24,
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255, 255, 255, 0.04)",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {t("This screen hit rough water")}
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#b9c3d2",
              margin: "12px 0 24px",
            }}
          >
            {t(
              "Something went wrong while drawing it. Your voyage is stored on the server, so nothing sailed on without you. Try again first; a reload settles what trying again does not.",
            )}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              width: "100%",
              height: 40,
              borderRadius: 12,
              border: "none",
              background: "#c96a2a",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("Try again")}
          </button>
        </div>
      </body>
    </html>
  );
}
