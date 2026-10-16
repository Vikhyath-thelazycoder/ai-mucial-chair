import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-cyan text-bg hover:brightness-110",
  attention: "bg-amber text-bg hover:brightness-110",
  danger: "bg-red text-bg hover:brightness-110",
  ghost: "border border-line bg-surface text-text hover:border-muted",
} as const;

const sizes = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-14 px-6 text-base", // player tap targets ≥ 56px (DESIGN.md › Spacing)
} as const;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  );
}
