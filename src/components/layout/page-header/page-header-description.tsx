import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/helpers";

export function PageHeaderDescription({
  className,
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "max-w-xl text-brand-olive-deep/80",
        className,
      )}
      {...props}
    />
  );
}
