import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/helpers";

export function PageHeaderTitle({
  className,
  ...props
}: ComponentProps<"h1">) {
  return (
    <h1 className={cn("font-sans text-4xl font-medium tracking-tight", className)} {...props} />
  );
}
