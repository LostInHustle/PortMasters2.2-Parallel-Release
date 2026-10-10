"use client";

import { cn } from "@/lib/utils";

/* The quiet little button every action on a roster row is built on: the
   peek eye, the host's mute toggle and the report flag. One shell rather
   than three copies of the same padding, hover and resting colour, so a
   change to how a row action looks lands on all of them at once. A caller
   brings only what is its own: the label read out to a screen reader, the
   tooltip, and whatever extra classes its own state needs.

   The label is required rather than optional, because a button whose only
   content is an icon is a button with no name: the tooltip is not read
   out, so an optional label is one a new call site forgets and nobody
   sees it until a screen reader user does. The type asks for it, so the
   compiler asks for it. */
export function IconButton({
  label,
  title,
  className,
  children,
  ...button
}: React.ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      {...button}
      aria-label={label}
      title={title}
      className={cn(
        "p-1 rounded-lg hover:bg-black/[0.05] dark:hover:bg-white/10 text-muted-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
