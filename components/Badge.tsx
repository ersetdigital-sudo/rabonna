import type { ComponentProps, ReactNode } from "react";

/**
 * Badge - glass pill label.
 *
 * Variants:
 *  - neutral: glass surface, ink text
 *  - filled:  surface-dark, on-dark
 *  - success / warning / info / danger: tinted bg (alpha) + brand color text
 */
type BadgeVariant =
  | "neutral"
  | "filled"
  | "success"
  | "warning"
  | "info"
  | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "glass text-ink",
  filled: "bg-surface-dark text-on-dark",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  danger: "bg-danger/15 text-danger",
};

interface BadgeProps extends ComponentProps<"span"> {
  variant?: BadgeVariant;
  children: ReactNode;
}

export function Badge({
  variant = "neutral",
  className = "",
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`text-caption inline-flex items-center gap-xs rounded-full px-md py-xs ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );
}
