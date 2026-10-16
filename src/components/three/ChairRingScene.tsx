"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRef } from "react";
import type { Group } from "three";
import { tokens } from "@/lib/design/tokens";
import { NeonChair } from "./NeonChair";
import { ringLayout } from "./ringLayout";

type Props = {
  count: number;
  /** Chairs (by index) drawn as locked/lit. */
  lit?: ReadonlySet<number>;
  /** Called when the device can't hold the frame rate, so the page can switch to the 2D fallback. */
  onSlow?: () => void;
  maxDpr?: number;
};

function Ring({ count, lit }: { count: number; lit?: ReadonlySet<number> }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.12;
  });
  const radius = Math.max(3.5, count * 0.55);
  return (
    <group ref={group}>
      {ringLayout(count, radius, radius * 0.75).map((slot, i) => (
        <group key={i} position={slot.position} rotation={[0, slot.rotationY, 0]}>
          <NeonChair color={lit?.has(i) ? tokens.lime : tokens.cyan} glow={lit?.has(i) ? 1.4 : 1} />
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={[1, 0.75, 1]}>
        <ringGeometry args={[radius + 0.9, radius + 1.0, 96]} />
        <meshBasicMaterial color={tokens.cyan} toneMapped={false} />
      </mesh>
    </group>
  );
}

/** The signature ring of glowing chairs (DESIGN.md › Visual direction). */
export default function ChairRingScene({ count, lit, onSlow, maxDpr = 1.5 }: Props) {
  const radius = Math.max(3.5, count * 0.55);
  return (
    <Canvas
      dpr={[1, maxDpr]}
      camera={{ position: [0, radius * 0.9, radius * 2.2], fov: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={onSlow} />
      <color attach="background" args={[tokens.bg]} />
      <fog attach="fog" args={[tokens.bg, radius * 2, radius * 4.5]} />
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 6, 0]} intensity={30} color={tokens.cyan} />
      <Ring count={count} lit={lit} />
      <EffectComposer>
        <Bloom intensity={1.2} luminanceThreshold={0.2} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
