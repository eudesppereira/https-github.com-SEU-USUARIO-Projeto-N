import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/lib/cx";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "text-white bg-linear-to-br from-[var(--color-tech-navy)] to-[var(--color-tech-navy-strong)] shadow-[var(--shadow-soft)] hover:brightness-110",
  secondary:
    "border-2 border-[var(--color-line-strong)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-tech-cyan)]",
  ghost: "text-[var(--color-ink-soft)] hover:bg-[var(--color-tech-cyan-soft)]",
  // CTA em cyan sólido — pro caso de botão sobre fundo já navy (ex.: card
  // "mais popular"), onde primary (navy sobre navy) perde contraste.
  accent: "bg-[var(--color-tech-cyan)] text-[var(--color-tech-navy-strong)] hover:brightness-105",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      className={cx(
        "rounded-full font-semibold transition disabled:opacity-50 disabled:hover:brightness-100",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...rest}
    />
  );
}
