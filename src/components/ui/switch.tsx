"use client";

import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

// The one on and off control in the app, in the two sizes it is drawn at.
//
// The small one is the house switch (see the lobby and the standing
// orders), and the wide one is the settings screen's. The wide one is
// wide because the settings rows are read at a glance and the control
// beside them has to be as easy to hit as the row is to read.
//
// They are one control because they are one control: a switch that looks
// one way in the lobby and another way in the settings is two things to
// learn, and the house rule about one meaning per shape applies to
// controls as much as to words. The size is a prop, so the behavior, the
// keyboard handling and the focus treatment are one implementation.
//
// The wide thumb's travel is the travel the setting's own control had:
// an eighth of a rem from the near end when the control is off, and the
// same eighth from the far end when it is on. The track and the thumb
// are both sized in rems, so the gaps are rems too, and the thumb lands
// in the same place at any text size.
const SWITCH_SIZES = {
  sm: {
    root: "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-input focus-visible:border-ring focus-visible:ring-ring/50 dark:data-[state=unchecked]:bg-input/80 inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs transition-all outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
    thumb:
      "bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-4 rounded-full ring-0 transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0",
  },
  lg: {
    root: "peer data-[state=checked]:bg-celadon data-[state=unchecked]:bg-black/20 dark:data-[state=unchecked]:bg-white/20 inline-flex h-6 w-11 shrink-0 items-center rounded-full border-0 shadow-none transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
    thumb:
      "pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-[cubic-bezier(0,0,0.58,1)] data-[state=checked]:translate-x-[1.375rem] data-[state=unchecked]:translate-x-[0.125rem]",
  },
} as const;

function Switch({
  size = "sm",
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  /** The size the control is drawn at. */
  size?: keyof typeof SWITCH_SIZES;
}) {
  const shape = SWITCH_SIZES[size];
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(shape.root, className)}
      {...props}
    >
      <SwitchPrimitive.Thumb data-slot="switch-thumb" className={shape.thumb} />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
