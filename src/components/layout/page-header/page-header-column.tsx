import { cn } from "@/lib/utils/helpers";

type Props = {
  className?: string
  children: React.ReactNode
};

export function PageHeaderColumn({ className, children }: Props) {
  return (
    <div className={cn("flex gap-2", className)}>
        {children}
    </div>
  );
}
