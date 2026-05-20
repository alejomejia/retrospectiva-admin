import { cn } from "@/lib/utils/helpers";

type Props = {
  number?: string;
  label: string;
  className?: string;
};

export function PageHeaderEyebrow({ number, label, className }: Props) {
  return (
    <p className={cn("text-caplet flex items-center gap-1", className)}>
      {number && <span className="text-brand-terracotta">{number}</span>}
      <span>{label}</span>
    </p>
  );
}
