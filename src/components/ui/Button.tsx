import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_10px_22px_rgba(0,169,124,0.32)]",
  secondary: "bg-ink text-white hover:opacity-90 shadow-[0_10px_22px_rgba(20,35,31,0.28)]",
  outline: "border-[1.6px] border-border-strong bg-surface text-foreground hover:bg-accent-soft/40",
  ghost: "text-foreground hover:bg-black/[0.05]",
  danger: "bg-danger text-white hover:opacity-90",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs rounded-full gap-1.5",
  md: "h-10 px-4.5 text-sm rounded-full gap-2",
  lg: "h-[52px] px-7 text-base rounded-full gap-2",
  icon: "h-9 w-9 rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-bold transition-colors disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none whitespace-nowrap",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
