"use client";

import { Edges } from "@react-three/drei";
import { tokens } from "@/lib/design/tokens";

// Procedural stand-in until the Blender chair (public/models/chair.glb, task T-701) replaces it.
const LEG_X = 0.38;
const LEG_Z = 0.38;

export function NeonChair({ color = tokens.cyan, glow = 1 }: { color?: string; glow?: number }) {
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[1, 0.1, 1]} />
        <meshStandardMaterial color={tokens.surface} emissive={color} emissiveIntensity={0.25 * glow} />
        <Edges color={color} />
      </mesh>
      <mesh position={[0, 1.5, -0.45]}>
        <boxGeometry args={[1, 1.1, 0.1]} />
        <meshStandardMaterial color={tokens.surface} emissive={color} emissiveIntensity={0.25 * glow} />
        <Edges color={color} />
      </mesh>
      {[
        [LEG_X, LEG_Z],
        [-LEG_X, LEG_Z],
        [LEG_X, -LEG_Z],
        [-LEG_X, -LEG_Z],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, 0.42, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.85, 8]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2 * glow} />
        </mesh>
      ))}
    </group>
  );
}
