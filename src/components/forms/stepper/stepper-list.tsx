import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/helpers";

export function StepperList({ className, ...props }: ComponentProps<"ol">) {
  return (
    <ol
      role="list"
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    />
  );
}
