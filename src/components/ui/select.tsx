import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * The one dropdown the harbor's boards draw.
 *
 * Four boards offer a choice from a fixed list (the Parley's captain
 * picker, the escort market's, the refit bench's, and the barter
 * composer's) and each of them used to write the same border, the same
 * radius and the same height out by hand. The barter composer's is the
 * small one, which is why the size lives in the base and the caller's own
 * className comes last: tailwind-merge lets a board ask for a different
 * height without any of them restating the border.
 *
 * Three boards came later and wrote the utilities out by hand again: the
 * manifest audit, the bazaar's desk and the maroon vote, four pickers
 * between them. A component that a later caller can miss is a component
 * that has to say where it belongs, so this note names the rule rather
 * than the boards: a dropdown in this game is this component, and a board
 * that needs a different height asks for it in className.
 *
 * Props are the element's own, so a caller still passes value, onChange
 * and the aria-label that names what the picker is choosing.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-9 rounded-md border border-input bg-transparent px-2 text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
