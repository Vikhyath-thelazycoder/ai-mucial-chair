"use client";

import { Environment, Html, Lightformer, MeshReflectorMaterial, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, Color, Group, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3, type Mesh } from "three";
import { tokens } from "@/lib/design/tokens";
import { stageRadius, ringLayout } from "./ringLayout";

/** `lit` lights a chair without a name (e.g. the home page demo); a holder name always lights it. */
export type StageChair = { number: number; holder: string | null; leaving: boolean; lit?: boolean };

type Props = {
  chairs: StageChair[];
  /** The ring turns while the music plays and settles otherwise. */
  spinning: boolean;
  /** Winners by rank; when set, the camera moves to the podium. */
  podium: { rank: number; name: string }[] | null;
  /** Changes once per podium reveal to fire one confetti burst (event_seq). */
  confettiKey: number | null;
  reducedMotion: boolean;
  /** "low" drops the mirrored floor and bloom (phones). A slow frame rate also switches to it, never to 2D. */
  quality?: "high" | "low";
  maxDpr?: number;
};

const CHAIR_URL = "/models/chair.glb";
const PODIUM_URL = "/models/podium.glb";
const PODIUM_X = 0; // the podium stands at the centre of the ring, revealed when the chairs clear
const ease = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

function Chair({ position, rotationY, holder, lit: litFlag, leaving, reducedMotion }: { position: [number, number, number]; rotationY: number; holder: string | null; lit?: boolean; leaving: boolean; reducedMotion: boolean }) {
  const { scene } = useGLTF(CHAIR_URL);
  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((o) => {
      if ((o as Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);
  const group = useRef<Group>(null);
  const glow = useRef<Group>(null);
  const lit = Boolean(holder) || Boolean(litFlag);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Glide to a new seat when the ring is rebuilt; sink and shrink away when the admin removes the chair.
    const rate = reducedMotion ? 30 : 4;
    g.position.x = ease(g.position.x, position[0], rate, dt);
    g.position.z = ease(g.position.z, position[2], rate, dt);
    g.position.y = ease(g.position.y, leaving ? -1.2 : 0, leaving ? 2.2 : rate, dt);
    g.rotation.y = ease(g.rotation.y, rotationY, rate, dt);
    const s = ease(g.scale.x, leaving ? 0.001 : 1, leaving ? 2.5 : rate, dt);
    g.scale.setScalar(s);
    if (glow.current) {
      const target = lit && !leaving ? 1 : 0.001;
      glow.current.scale.setScalar(ease(glow.current.scale.x, target, reducedMotion ? 30 : 5, dt));
    }
  });

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={model} />
      {/* Locked: a warm spotlight pool and beam, plus the holder's name. */}
      <group ref={glow} scale={0.001}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
          <circleGeometry args={[0.42, 48]} />
          <meshBasicMaterial color={tokens.gold} transparent opacity={0.35} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.6, 0]}>
          <coneGeometry args={[0.45, 3.2, 40, 1, true]} />
          <meshBasicMaterial color={tokens.gold} transparent opacity={0.07} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {holder && !leaving && (
        <Html position={[0, 1.18, 0]} center distanceFactor={6} zIndexRange={[20, 0]}>
          <div className="pointer-events-none max-w-[14ch] truncate rounded-full border border-gold/60 bg-bg/80 px-4 py-1.5 font-display text-2xl font-extrabold whitespace-nowrap text-gold shadow-[0_0_24px_rgb(255_213_74/0.35)]">
            {holder}
          </div>
        </Html>
      )}
    </group>
  );
}

function Ring({ chairs, spinning, hidden, reducedMotion }: { chairs: StageChair[]; spinning: boolean; hidden: boolean; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const speed = useRef(0);
  const present = chairs.filter((c) => !c.leaving).length;
  const radius = stageRadius(present);
  // Seats are laid out for the chairs that stay; leaving chairs keep their last seat while they sink.
  const seats = useMemo(() => {
    const slots = ringLayout(present, radius, radius);
    let i = 0;
    const map = new Map<number, (typeof slots)[number]>();
    for (const c of chairs) if (!c.leaving) map.set(c.number, slots[i++]);
    return map;
  }, [chairs, present, radius]);
  const lastSeat = useRef(new Map<number, { position: [number, number, number]; rotationY: number }>());

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    speed.current = ease(speed.current, spinning && !reducedMotion ? 0.16 : 0, 1.5, dt);
    g.rotation.y += speed.current * dt;
    const s = ease(g.scale.x, hidden ? 0.001 : 1, 2.5, dt);
    g.scale.setScalar(s);
  });

  return (
    <group ref={group}>
      {chairs.map((c) => {
        const seat = seats.get(c.number) ?? lastSeat.current.get(c.number) ?? { position: [0, 0, 0] as [number, number, number], rotationY: 0 };
        if (!c.leaving) lastSeat.current.set(c.number, seat);
        return <Chair key={c.number} position={seat.position} rotationY={seat.rotationY} holder={c.holder} lit={c.lit} leaving={c.leaving} reducedMotion={reducedMotion} />;
      })}
    </group>
  );
}

function Podium({ winners, visible, reducedMotion }: { winners: { rank: number; name: string }[]; visible: boolean; reducedMotion: boolean }) {
  const { nodes } = useGLTF(PODIUM_URL);
  const podium = useMemo(() => prepare(nodes.Podium), [nodes]);
  const trophy = useMemo(() => prepare(nodes.Trophy), [nodes]);
  const group = useRef<Group>(null);
  const trophyRef = useRef<Group>(null);

  useFrame((state, dt) => {
    if (group.current) group.current.position.y = ease(group.current.position.y, visible ? 0 : -1.5, reducedMotion ? 30 : 1.6, dt);
    if (trophyRef.current) {
      trophyRef.current.position.y = ease(trophyRef.current.position.y, visible ? 0 : -0.8, reducedMotion ? 30 : 1.1, dt);
      if (!reducedMotion) trophyRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  const steps: Record<number, [number, number]> = { 1: [0, 0.62], 2: [-1.02, 0.44], 3: [1.02, 0.3] };
  return (
    <group ref={group} position={[PODIUM_X, -1.5, 0]}>
      <primitive object={podium} />
      <group ref={trophyRef} position={[0, -0.8, 0]}>
        <primitive object={trophy} />
      </group>
      {visible &&
        winners
          .filter((w) => steps[w.rank])
          .map((w) => {
            const [x, h] = steps[w.rank];
            return (
              <Html key={w.rank} position={[x, h + (w.rank === 1 ? 1.05 : 0.45), 0.1]} center distanceFactor={5} zIndexRange={[20, 0]}>
                <div className={`pointer-events-none text-center font-display font-extrabold whitespace-nowrap ${w.rank === 1 ? "text-5xl text-gold" : "text-3xl text-text"} drop-shadow-[0_0_18px_rgb(0_0_0/0.9)]`}>
                  <div className="text-base tracking-[0.2em] text-muted">{w.rank === 1 ? "WINNER" : `#${w.rank}`}</div>
                  {w.name}
                </div>
              </Html>
            );
          })}
    </group>
  );
}

function prepare(node: Object3D | undefined): Object3D {
  const o = (node ?? new Object3D()).clone(true);
  o.traverse((m) => {
    if ((m as Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

const CONFETTI = 320;
const CONFETTI_COLORS = [tokens.gold, tokens.cyan, tokens.red, tokens.text, tokens.lime];

/** One burst of falling, tumbling paper over the podium per `burstKey`. */
function Confetti({ burstKey }: { burstKey: number | null }) {
  const mesh = useRef<InstancedMesh>(null);
  const parts = useMemo(
    () =>
      Array.from({ length: CONFETTI }, () => ({
        p: new Vector3(),
        v: new Vector3(),
        spin: new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        q: new Quaternion(),
      })),
    [],
  );
  const started = useRef<number | null>(null);
  const tmp = useMemo(() => ({ m: new Matrix4(), o: new Object3D() }), []);

  useEffect(() => {
    if (burstKey === null || !mesh.current) return;
    parts.forEach((pt, i) => {
      pt.p.set((Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4);
      const a = Math.random() * Math.PI * 2;
      const s = 1.2 + Math.random() * 2.2;
      pt.v.set(Math.cos(a) * s * 0.7, 3 + Math.random() * 3.5, Math.sin(a) * s * 0.5);
      mesh.current!.setColorAt(i, new Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]));
    });
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
    started.current = 0;
  }, [burstKey, parts]);

  useFrame((_, dt) => {
    const m = mesh.current;
    if (!m || started.current === null) return;
    started.current += dt;
    const step = Math.min(dt, 1 / 30);
    parts.forEach((pt, i) => {
      pt.v.y -= 4.2 * step; // gravity, softened by air drag below
      pt.v.multiplyScalar(1 - 1.4 * step);
      pt.p.addScaledVector(pt.v, step);
      tmp.o.position.copy(pt.p);
      tmp.o.rotation.set(pt.spin.x * started.current!, pt.spin.y * started.current!, pt.spin.z * started.current!);
      tmp.o.scale.setScalar(pt.p.y < -0.2 ? 0 : 1);
      tmp.o.updateMatrix();
      m.setMatrixAt(i, tmp.o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    if (started.current > 8) started.current = null;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI]} position={[PODIUM_X, 0, 0]} frustumCulled={false}>
      <planeGeometry args={[0.035, 0.055]} />
      <meshStandardMaterial side={2} roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
}

/** Eases the camera between the ring view and the podium close-up. */
function CameraRig({ radius, podium }: { radius: number; podium: boolean }) {
  const { camera } = useThree();
  const look = useRef(new Vector3(0, 0.5, 0));
  useFrame((_, dt) => {
    const target = podium ? new Vector3(PODIUM_X, 1.25, 3.6) : new Vector3(0, radius * 0.95 + 1.1, radius * 2.15 + 1.6);
    const lookAt = podium ? new Vector3(PODIUM_X, 0.75, 0) : new Vector3(0, 0.35, 0);
    camera.position.lerp(target, 1 - Math.exp(-1.6 * dt));
    look.current.lerp(lookAt, 1 - Math.exp(-1.6 * dt));
    camera.lookAt(look.current);
  });
  return null;
}

/** The projector's live 3D stage (F15): realistic chairs on a glossy stage under studio light. */
export default function StageScene({ chairs, spinning, podium, confettiKey, reducedMotion, quality: initialQuality = "high", maxDpr = 2 }: Props) {
  const [quality, setQuality] = useState(initialQuality);
  const high = quality === "high";
  const present = chairs.filter((c) => !c.leaving).length;
  const radius = stageRadius(present);
  const showPodium = podium !== null;
  return (
    <Canvas
      shadows
      dpr={[1, maxDpr]}
      camera={{ position: [0, radius + 1.1, radius * 2.15 + 1.6], fov: 38, near: 0.1, far: 80 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setQuality("low")} />
      <color attach="background" args={[tokens.bg]} />
      <fog attach="fog" args={[tokens.bg, radius * 2.5 + 4, radius * 5 + 10]} />

      {/* Studio reflections for wood, leather, lacquer and gold; built from light panels, no downloads. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 5, -2]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[5, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" color={tokens.amber} intensity={1.5} position={[0, 3, 6]} scale={3} />
      </Environment>
      <ambientLight intensity={0.08} />
      <spotLight
        position={[2.5, 7, 4]}
        angle={0.62}
        penumbra={0.8}
        intensity={90}
        castShadow
        shadow-mapSize={high ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0002}
        color="#FFF1DC"
      />
      <spotLight position={[-4, 4, -4]} angle={0.7} penumbra={1} intensity={30} color={tokens.cyan} />

      <Suspense fallback={null}>
        <Ring chairs={chairs} spinning={spinning} hidden={showPodium} reducedMotion={reducedMotion} />
        <Podium winners={podium ?? []} visible={showPodium} reducedMotion={reducedMotion} />
        {!reducedMotion && <Confetti burstKey={confettiKey} />}
      </Suspense>

      {/* Glossy black stage floor with soft, blurred reflections. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius + 6, 96]} />
        {high ? (
        <MeshReflectorMaterial
          resolution={512}
          blur={[400, 120]}
          mixBlur={1}
          mixStrength={1.6}
          mirror={0.6}
          roughness={0.85}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
          color="#0B0B12"
          metalness={0.4}
        />
        ) : (
          <meshStandardMaterial color="#0B0B12" roughness={0.55} metalness={0.3} />
        )}
      </mesh>

      <CameraRig radius={radius} podium={showPodium} />
      {high && (
        <EffectComposer>
          <Bloom intensity={0.45} luminanceThreshold={0.85} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}

useGLTF.preload(CHAIR_URL);
useGLTF.preload(PODIUM_URL);
