"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
  title: string;
  description?: ReactNode;
  /** Ask for text (a reason, a PIN, a typed confirmation). */
  input?: { label: string; placeholder?: string; mustEqual?: string; pattern?: RegExp; inputMode?: "numeric" | "text" };
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (value: string) => Promise<string | null | undefined | void> | string | null | undefined | void;
  onClose: () => void;
  children?: ReactNode;
};

/** Accessible confirm dialog. Returning an error string from onConfirm keeps it open and shows the error. */
export function Modal({ title, description, input, confirmLabel, danger, onConfirm, onClose, children }: Props) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid =
    !input ||
    (value.trim().length > 0 &&
      (input.mustEqual === undefined || value === input.mustEqual) &&
      (input.pattern === undefined || input.pattern.test(value)));

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const result = await onConfirm(value.trim());
    setBusy(false);
    if (typeof result === "string") setError(result);
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
        <h2 id="modal-title" className="text-xl font-bold">
          {title}
        </h2>
        {description && <div className="mt-2 text-sm text-muted">{description}</div>}
        {children}
        <form
          className="mt-5 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid && !busy) void confirm();
          }}
        >
          {input && (
            <label className="flex flex-col gap-1.5 text-sm">
              {input.label}
              <input
                autoFocus
                value={value}
                inputMode={input.inputMode}
                placeholder={input.placeholder}
                onChange={(e) => setValue(e.target.value)}
                className="min-h-11 rounded-xl border border-line bg-bg px-3 text-base outline-none focus:border-cyan"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red/10 p-3 text-sm text-red">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} autoFocus={!input}>
              Cancel
            </Button>
            <Button type="submit" variant={danger ? "danger" : "primary"} disabled={!valid || busy}>
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
