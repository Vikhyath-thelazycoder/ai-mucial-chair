import { ringLayout } from "./ringLayout";

/** Lightweight CSS/SVG stand-in for the 3D ring on low-power devices and with reduced motion. */
export function ChairRing2D({ count, lit }: { count: number; lit?: ReadonlySet<number> }) {
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-[2/1] w-full max-w-3xl">
      <div className="absolute inset-[18%_8%] rounded-[50%] border-2 border-cyan/40 shadow-[0_0_60px_rgb(34_228_255/0.25)]" />
      {ringLayout(count, 42, 30).map((slot, i) => {
        const [x, , z] = slot.position;
        const depth = (z + 30) / 60; // 0 = back, 1 = front
        const size = 28 + depth * 28;
        const on = lit?.has(i);
        return (
          <svg
            key={i}
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth={1.7}
            strokeLinecap="round"
            className={on ? "absolute stroke-lime" : "absolute stroke-cyan"}
            style={{
              left: `calc(${50 + x}% - ${size / 2}px)`,
              top: `calc(${50 + z * 0.9}% - ${size / 2}px)`,
              width: size,
              height: size,
              opacity: 0.45 + depth * 0.55,
              filter: `drop-shadow(0 0 8px ${on ? "#B6FF3B" : "#22E4FF"})`,
            }}
          >
            <path d="M7 3v10M7 13h11M8 13v8M17 13v8M7 8h6" />
          </svg>
        );
      })}
    </div>
  );
}
