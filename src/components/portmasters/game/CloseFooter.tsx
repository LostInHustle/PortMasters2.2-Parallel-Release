"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The close row every reading dialog ends on: a secondary button that
 * closes the dialog it sits in, right aligned. The label and an outer
 * class are the only differences between its uses, so both are props;
 * nothing else about the row is a decision.
 */
export function CloseFooter({
  onClose,
  label = "Close",
  className,
}: {
  onClose: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-end", className)}>
      <Button variant="secondary" onClick={onClose}>
        {label}
      </Button>
    </div>
  );
}
