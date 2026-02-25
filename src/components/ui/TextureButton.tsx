import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";
import type { ButtonHTMLAttributes } from "react";

const buttonVariants = cva(
  "relative inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        default:
          "bg-white/10 text-white hover:bg-white/20 border border-white/10",
        primary:
          "bg-white text-black hover:bg-white/90 border border-white/20",
        success:
          "bg-success/80 text-white hover:bg-success border border-success/30",
        danger:
          "bg-error/80 text-white hover:bg-error border border-error/30",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface TextureButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function TextureButton({
  className,
  variant,
  size,
  ...props
}: TextureButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
