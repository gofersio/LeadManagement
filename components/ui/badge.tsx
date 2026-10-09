import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-label-sm uppercase",
        variant === "default" && "bg-primary-fixed text-primary",
        variant === "secondary" && "bg-surface-container-high text-on-surface-variant",
        variant === "success" && "bg-primary-fixed text-primary",
        variant === "warning" && "bg-error-container text-on-error-container",
        className,
      )}
      {...props}
    />
  );
}
