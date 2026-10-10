import { ImageResponse } from "next/og";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/game/constants/brand";
import { AnchorMark } from "./_art/anchor";

// The card every shared link unfolds into. Built here rather than kept as
// a committed png for the reason the apple icon is: the game's name, its
// own sentence and its colors all live in the tree, and art that copies
// them is art that goes stale the first time one of them moves.
//
// The copy is the same sentence the metadata carries, from the same
// constant, so a link preview and the page it opens cannot describe the
// game two different ways.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${APP_NAME}: ${APP_DESCRIPTION}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(150deg, #0b1524 0%, #101a2c 55%, #17253c 100%)",
        padding: 72,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontSize: 58, color: "#f2efe6" }}>{APP_NAME}</div>
        <AnchorMark size={104} ink="#e6b23c" />
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 34,
          lineHeight: 1.45,
          color: "#a9bcd0",
          maxWidth: 940,
        }}
      >
        {APP_DESCRIPTION}
      </div>
    </div>,
    { ...size },
  );
}
