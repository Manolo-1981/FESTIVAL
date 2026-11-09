import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ variant = "primary", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-[background-color,opacity] duration-150 pressable disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg",
        variant === "secondary" && "border border-line bg-surface-2 text-fg",
        variant === "ghost" && "text-muted",
        className,
      )}
      {...props}
    />
  );
}
