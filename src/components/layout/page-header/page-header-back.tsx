import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils/helpers";

type Props = {
  href: string;
  label: string;
  className?: string;
};

export function PageHeaderBack({ href, label, className }: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "text-caplet col-span-full inline-flex items-center gap-1.5 hover:text-brand-terracotta",
        className,
      )}
    >
      <ArrowLeft className="size-3" />
      {label}
    </Link>
  );
}
