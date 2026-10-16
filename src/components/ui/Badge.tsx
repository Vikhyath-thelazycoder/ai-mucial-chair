const tones = {
  locked: "bg-lime text-bg",
  wrong: "bg-red text-bg",
  attention: "bg-amber text-bg",
  info: "bg-cyan text-bg",
  neutral: "bg-line text-muted",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold tracking-[0.08em] uppercase ${tones[tone]}`}>
      {children}
    </span>
  );
}
