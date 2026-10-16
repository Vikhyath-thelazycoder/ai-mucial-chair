import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; name: string; error?: string; hint?: string };

export function Field({ label, name, error, hint, className = "", ...input }: Props) {
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 text-left ${className}`}>
      <label htmlFor={name} className="text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`min-h-14 rounded-xl border bg-bg px-4 text-base text-text outline-none placeholder:text-muted/60 focus:border-cyan ${
          error ? "border-red" : "border-line"
        }`}
        {...input}
      />
      {error ? (
        <p id={`${name}-error`} className="text-sm text-red">
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
