const tones = {
  cyan: "text-cyan [text-shadow:0_0_28px_rgb(34_228_255/0.6)]",
  amber: "text-amber [text-shadow:0_0_28px_rgb(255_176_32/0.7)]",
  lime: "text-lime [text-shadow:0_0_28px_rgb(182_255_59/0.6)]",
  red: "text-red [text-shadow:0_0_28px_rgb(255_59_92/0.6)]",
  gold: "text-gold [text-shadow:0_0_28px_rgb(255_213_74/0.6)]",
} as const;

/** The one big state word a screen is about (DESIGN.md › Component principles), announced to screen readers. */
export function StateWord({ tone, children }: { tone: keyof typeof tones; children: React.ReactNode }) {
  return (
    <p
      aria-live="assertive"
      className={`font-display text-5xl font-black tracking-[0.08em] uppercase sm:text-7xl ${tones[tone]}`}
    >
      {children}
    </p>
  );
}
