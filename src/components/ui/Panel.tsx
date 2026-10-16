import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  as?: "section" | "div" | "aside";
  /** Glass style for panels floating over the 3D stage (admin, screen). */
  glass?: boolean;
};

export function Panel({ as: Tag = "section", glass = false, className = "", ...rest }: Props) {
  const surface = glass ? "bg-surface/70 backdrop-blur-md" : "bg-surface";
  return <Tag className={`rounded-2xl border border-line p-4 ${surface} ${className}`} {...rest} />;
}
