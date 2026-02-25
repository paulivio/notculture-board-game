import { cn } from "../../lib/utils";
import type { HTMLAttributes } from "react";

interface TextureCardProps extends HTMLAttributes<HTMLDivElement> {}

export function TextureCard({ className, ...props }: TextureCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/10 bg-surface p-5 shadow-lg",
        className
      )}
      {...props}
    />
  );
}
