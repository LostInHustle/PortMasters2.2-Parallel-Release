"use client";

// The last boundary: the one that catches a throw in the root layout
// itself, which means nothing above it survived, including the layout
// that loads the game's stylesheet. That is why every rule below is an
// inline style rather than a class: a class would be a name with no
// stylesheet behind it, and this screen would render as unstyled text at
// the exact moment the game is least able to explain itself.
//
// It carries the same words as the screen-level boundary beside it, so
// the two failures read as one game handling one kind of problem, and
// its only action is a reload, because at this level there is no segment
// left to re-render.

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
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
            This screen hit rough water
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.6,
              color: "#b9c3d2",
              margin: "12px 0 24px",
            }}
          >
            Something went wrong while drawing it. Your voyage is stored on the
            server, so nothing sailed on without you. Try again first; a reload
            settles what trying again does not.
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
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
