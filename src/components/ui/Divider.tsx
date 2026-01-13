import { cn } from "@/utils/cn";

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-white/10", className)} />;
}
