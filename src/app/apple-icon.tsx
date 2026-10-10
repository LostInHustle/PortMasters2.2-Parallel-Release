import { ImageResponse } from "next/og";
import { AnchorMark } from "./_art/anchor";

// The icon iOS pins to a home screen. The file conventions are the
// reason this is an image built rather than an image committed: a real
// icon is a binary asset nobody in this tree can regenerate, and the
// moment the palette moves it is wrong in a way no check can see. This
// one is painted from the same two colors the dark canvas is drawn in,
// so it follows them.
//
// The tile is square rather than rounded on purpose: iOS masks the
// corners itself, at whatever radius the running version uses, and a
// radius baked into the art would show up as a seam inside the system's
// own mask.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#101521",
      }}
    >
      <AnchorMark size={116} ink="#e6b23c" />
    </div>,
    { ...size },
  );
}
