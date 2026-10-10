// The harbour anchor, rebuilt from primitives for the two generated
// images beside this folder. The app icon and the social card are drawn
// through satori, which lays out boxes and borders and does not rasterize
// an svg element, so the game's mark cannot be handed to it as the path
// the interface uses. What it can be handed is the same geometry: the
// ring, the shaft, the two level ticks and the curved arms below, at the
// proportions the icon set draws them, which is what the numbers in the
// 24 unit space below are. The static favicon beside this folder draws
// the same mark with the real curves; this is the same shape stated in
// the only vocabulary the image renderer reads, and the two are kept
// honest by the one place they are both described, the ratios.
//
// Everything scales from a 24 unit box the way an svg would, so a caller
// asks for a size and gets the same mark at it. The ink is the caller's,
// because the mark sits on a dark tile in both images and the caller is
// what knows the tile's color.

const box = (u: number, l: number, t: number, w: number, h: number) => ({
  position: "absolute" as const,
  left: l * u,
  top: t * u,
  width: w * u,
  height: h * u,
});

export function AnchorMark({ size, ink }: { size: number; ink: string }) {
  const u = size / 24;
  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
      }}
    >
      {/* The ring at the top: r 3 with a 2 wide stroke, so its outer edge
          is a circle of 4 from the centre. */}
      <div
        style={{
          ...box(u, 8, 1, 8, 8),
          border: `${2 * u}px solid ${ink}`,
          borderRadius: 999,
        }}
      />
      {/* The shaft, from inside the ring's lower stroke to the arms'
          bottom, its ends rounded as the path's own caps are. */}
      <div
        style={{
          ...box(u, 11, 7, 2, 16),
          background: ink,
          borderRadius: 1 * u,
        }}
      />
      {/* The two short ticks, from each outer edge inward, level with the
          top of the arms. */}
      <div
        style={{
          ...box(u, 1, 11, 5, 2),
          background: ink,
          borderRadius: 1 * u,
        }}
      />
      <div
        style={{
          ...box(u, 18, 11, 5, 2),
          background: ink,
          borderRadius: 1 * u,
        }}
      />
      {/* The arms: the lower half of a circle of r 10 around the centre,
          drawn as a box whose bottom corners carry the outer radius. */}
      <div
        style={{
          ...box(u, 1, 11, 22, 12),
          border: `${2 * u}px solid ${ink}`,
          borderTop: "none",
          borderRadius: `0 0 ${11 * u}px ${11 * u}px`,
        }}
      />
    </div>
  );
}
