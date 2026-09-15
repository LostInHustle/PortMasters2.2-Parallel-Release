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

// The hosts a browser reaches this development server on, beyond the two
// that Next.js already allows.
//
// Next.js refuses a cross site caller the development resources: the
// compiled chunks under /_next, the hot reload channel, and the internal
// endpoints under /__nextjs. "localhost" and any name under it are allowed
// already, so only the ways in that it does not cover are written out
// below. The list is scanned in order and the first match wins, so the
// order here is for the reader rather than for the matcher: loopback
// first, then this machine on the local network, then the addresses a
// network hands out, then the tunnel.
const localOrigins = [
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
];

// The hostnames the hosting platform answers on, which cannot be written
// down in advance because the platform is what names them.
//
// This list carries more weight than its size suggests. The hosted
// deployment runs the development server rather than a production build,
// because the plan it runs on does not have the memory to complete
// `next build`. That makes these entries the difference between the site
// working and the site loading its HTML and then failing every chunk that
// would make it do anything.
//
// Railway holds the public hostname of the running service in
// RAILWAY_PUBLIC_DOMAIN and injects it into the container, so a deployment
// is allowed through with nothing to configure. That variable does not
// follow a custom domain, so a service that also answers on one names it
// in ALLOWED_DEV_ORIGINS, as a comma separated list. Neither is read by a
// production build, and neither is read by the application itself: both
// exist for the guard described above and nothing else.
const hostedOrigins = [
  process.env.RAILWAY_PUBLIC_DOMAIN,
  ...(process.env.ALLOWED_DEV_ORIGINS ?? "").split(","),
]
  .map((origin) => origin?.trim())
  .filter((origin): origin is string => Boolean(origin));

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

  // The floating badge Next.js draws in a corner of the window while the
  // development server is running. It reports the route and how the page
  // was rendered, which is worth having while the interface is being
  // built and is noise everywhere else. Turning it off costs nothing: a
  // compile or a runtime error is still reported. The hosted deployment
  // runs the development server, so leaving it on would put it on top of
  // the game for every player.
  devIndicators: false,

  allowedDevOrigins: [...localOrigins, ...hostedOrigins],
};

export default nextConfig;
