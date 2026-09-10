import type { NextConfig } from "next";

// Everything this app needs from Next.js is served by server.ts, a custom
// Node server that puts the Next.js request handler and the Socket.IO
// realtime layer on one HTTP listener and one port. There is deliberately
// no output: "standalone" here, because nothing bundles a self contained
// server any more: the process runs from this source tree.
const nextConfig: NextConfig = {
  // Pins the bundler to this folder. Without it Turbopack walks up the
  // directory tree looking for a lockfile and a git root, finds unrelated
  // files above the project, and warns that it is guessing. npm always
  // runs these scripts from the project root, so the working directory is
  // the right answer every time.
  turbopack: { root: process.cwd() },
  // Catches effects that do not clean up after themselves, which is the
  // class of bug that leaks a socket or a timer every time a captain
  // opens a panel. Development only; production builds are unaffected.
  reactStrictMode: true,
  // Type errors fail the build on purpose. The checker is already clean,
  // so anything that trips it is a real regression that should not ship.
} satisfies NextConfig;

export default nextConfig;
