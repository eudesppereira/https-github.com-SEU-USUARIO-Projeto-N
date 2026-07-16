import type { HTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type SurfaceVariant = "solid" | "glass-dark" | "glass-light";

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
}

const VARIANT_CLASSES: Record<SurfaceVariant, string> = {
  solid:
    "bg-[var(--color-surface)] border border-[var(--color-line)] shadow-[var(--shadow-soft)]",
  "glass-dark":
    "border  bg-[var(--color-tech-navy)] border-white/15 text-white shadow-[var(--shadow-lifted)]",
  "glass-light":
    "border  bg-[var(--color-surface)] border-[var(--color-line)] shadow-[var(--shadow-soft)]",
};

export function Surface({ variant = "solid", className, children, ...rest }: SurfaceProps) {
  return (
    <div className={cx("rounded-xl", VARIANT_CLASSES[variant], className)} {...rest}>
      {children}
    </div>
  );
}
