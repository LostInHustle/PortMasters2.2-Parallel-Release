import type { NextConfig } from "next";

// Everything this app needs from Next.js is served by server.ts, a custom
// Node server that puts the Next.js request handler and the Socket.IO
// realtime layer on one HTTP listener and one port. There is deliberately
// no output: "standalone" here, because nothing bundles a self contained
// server any more: the process runs from this source tree.
//
// Type errors fail the build on purpose. The checker is already clean, so
// anything that trips it is a real regression that should not ship, and
// typescript.ignoreBuildErrors is the one setting that must never be added
// here to get around it.
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

  // The hosts allowed to take a Next.js development resource from this
  // server: the compiled chunks under /_next, the hot reload channel, and
  // the internal endpoints under /__nextjs. Next.js refuses all three to a
  // cross site caller, which is the right default, and this list is the
  // only way to name the exceptions. Development only. A production build
  // neither reads this nor runs the code that consults it.
  //
  // "localhost" and any name under it are allowed by Next.js already, so
  // only the ways in that it does not cover are written out below. The
  // list is scanned in order and the first match wins, so the order here
  // is for the reader rather than for the matcher: loopback first, then
  // this machine on the local network, then the addresses a network hands
  // out, then the tunnel.
  allowedDevOrigins: [
    // The loopback address. "localhost" is already covered, but a browser
    // pointed at 127.0.0.1 sends that address as its origin instead, and
    // the bare address is not a name Next.js recognises on its own.
    "127.0.0.1",
    // This machine reached by its own name. macOS answers to a name ending
    // in ".local" over Bonjour, and the README sends a second player to
    // exactly that.
    "*.local",
    // A private address on the same network, which is what a phone or a
    // second laptop on the same wifi is actually using. The third private
    // range, 172.16 through 172.31, is left out: it takes sixteen entries
    // of this shape to cover, and it is the one a home network almost
    // never hands out.
    "192.168.*.*",
    "10.*.*.*",
    // The tunnel the README sets up. A free ngrok account is issued a name
    // under ngrok-free.dev or ngrok-free.app, and an account older than
    // those two still answers under ngrok.io. Every pattern below carries
    // both segments before the suffix on purpose: a single wildcard covers
    // exactly one name segment, so a bare "*.dev" matches a name like
    // "boat.dev" and could never match a tunnel name, which always has two
    // labels ahead of the suffix.
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "*.ngrok.io",
  ],
};

export default nextConfig;
