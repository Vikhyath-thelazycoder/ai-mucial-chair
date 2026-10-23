"use client";

import { Billboard, Environment, Html, Lightformer, MeshReflectorMaterial, OrbitControls, PerformanceMonitor, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { createContext, Suspense, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AdditiveBlending, CanvasTexture, Color, Group, InstancedMesh, Matrix4, MeshBasicMaterial, MeshStandardMaterial, Object3D, SRGBColorSpace, Vector3, type Mesh } from "three";
import { tokens } from "@/lib/design/tokens";
import { placeLabels, type Shift } from "@/lib/screen/labels";
import { fitCamera, SEAT_LIGHT, shirtColor } from "@/lib/screen/stage";
import type { SeatState } from "@/lib/screen/view";
import { ringLayout, stageRadius } from "./ringLayout";

export type StageChair = { number: number; occupant: string | null; state: SeatState; leaving: boolean };

type Props = {
  chairs: StageChair[];
  /** The ring turns while the music plays and settles otherwise. */
  spinning: boolean;
  /** Winners by rank; when set, the camera moves to the podium. */
  podium: { rank: number; name: string }[] | null;
  /** Changes once per podium reveal to fire one confetti burst (event_seq). */
  confettiKey: number | null;
  reducedMotion: boolean;
  /** Show chair number plates and seated people (projector). Off for the small decorative ring. */
  showPeople?: boolean;
  /** Drag to rotate around the ring (projector only). Zoom stays automatic so every chair fits. */
  interactive?: boolean;
  /** "low" drops the mirrored floor and bloom (phones). A slow frame rate also switches to it, never to 2D. */
  quality?: "high" | "low";
  maxDpr?: number;
  /** Phone layout: fixed-size name tags and winner labels that stay readable on a small canvas, drag turns only. */
  compact?: boolean;
};

const CHAIR_URL = "/models/chair.glb";
const MAN_URL = "/models/man.glb";
const PODIUM_URL = "/models/podium.glb";
const LEAVE_MS = 1600;
const ease = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

function withShadows<T extends Object3D>(o: T): T {
  o.traverse((m) => {
    if ((m as Mesh).isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

/** Seat number on a small plate floating behind the backrest, always facing the audience. */
function NumberPlate({ number }: { number: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const draw = () => {
      const ctx = canvas.getContext("2d")!;
      const family = getComputedStyle(document.body).getPropertyValue("--font-orbitron").trim() || "sans-serif";
      ctx.clearRect(0, 0, 256, 256);
      ctx.fillStyle = "rgba(7,7,12,0.82)";
      ctx.beginPath();
      ctx.roundRect(8, 8, 240, 240, 48);
      ctx.fill();
      ctx.lineWidth = 8;
      ctx.strokeStyle = tokens.gold;
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${number >= 100 ? 92 : 128}px ${family}`;
      ctx.fillText(String(number), 128, 138);
      tex.needsUpdate = true;
    };
    draw();
    void document.fonts?.ready.then(draw);
    return tex;
  }, [number]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <Billboard position={[0, 1.12, -0.36]}>
      <mesh>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} depthWrite={false} />
      </mesh>
    </Billboard>
  );
}

/** A realistic seated man (Blender, CC0 base mesh) in the player's shirt colour. Sits down on mount. */
function Person({ name, leaving, reducedMotion }: { name: string; leaving: boolean; reducedMotion: boolean }) {
  const { scene } = useGLTF(MAN_URL);
  const model = useMemo(() => {
    const clone = withShadows(scene.clone(true));
    clone.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh && (mesh.material as MeshStandardMaterial).name === "ManShirt") {
        const shirt = (mesh.material as MeshStandardMaterial).clone();
        shirt.color = new Color(shirtColor(name));
        mesh.material = shirt;
      }
    });
    return clone;
  }, [scene, name]);
  const group = useRef<Group>(null);
  const t0 = useRef<number | null>(null);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    t0.current ??= state.clock.elapsedTime;
    if (leaving) {
      // Stands up and walks off backwards out of the ring.
      g.position.y = ease(g.position.y, 0.55, reducedMotion ? 30 : 3, dt);
      g.position.z = ease(g.position.z, -0.9, reducedMotion ? 30 : 1.6, dt);
      g.scale.setScalar(ease(g.scale.x, 0.001, reducedMotion ? 30 : 2.2, dt));
    } else {
      g.position.y = ease(g.position.y, 0, reducedMotion ? 30 : 5, dt);
      g.scale.setScalar(ease(g.scale.x, 1, reducedMotion ? 30 : 6, dt));
      if (!reducedMotion) g.rotation.y = Math.sin((state.clock.elapsedTime - t0.current) * 0.7 + name.length) * 0.025; // alive, not frozen
    }
  });

  return (
    <group ref={group} position={[0, reducedMotion ? 0 : 0.45, 0]} scale={reducedMotion ? 1 : 0.6}>
      <primitive object={model} />
    </group>
  );
}

function SeatLight({ state }: { state: SeatState }) {
  const color = SEAT_LIGHT[state];
  const pool = useRef<MeshBasicMaterial>(null);
  const cone = useRef<MeshBasicMaterial>(null);
  const strength = useRef(0);
  useFrame((_, dt) => {
    strength.current = ease(strength.current, color ? 1 : 0, 4, dt);
    if (pool.current) pool.current.opacity = 0.42 * strength.current;
    if (cone.current) cone.current.opacity = (state === "seated" ? 0.05 : 0.11) * strength.current;
  });
  const c = color ?? "#000000";
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.5, 48]} />
        <meshBasicMaterial ref={pool} color={c} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.75, 0]}>
        <coneGeometry args={[0.55, 3.5, 40, 1, true]} />
        <meshBasicMaterial ref={cone} color={c} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

type Tag = { anchor: Object3D; el: HTMLDivElement; line: HTMLDivElement; now: Shift; target: Shift };
const Tags = createContext<Map<string, Tag> | null>(null);

/** A callback ref for a name tag (Html mounts its children in a separate root, so plain refs can lag). */
function useTagRef(id: string, anchor: React.RefObject<Object3D | null>) {
  const tags = useContext(Tags);
  return useCallback(
    (node: HTMLDivElement | null) => {
      if (!tags) return;
      if (node && anchor.current) {
        const prev = tags.get(id);
        tags.set(id, { anchor: anchor.current, el: node, line: node.lastElementChild as HTMLDivElement, now: prev?.now ?? { dx: 0, dy: 0 }, target: prev?.target ?? { dx: 0, dy: 0 } });
      } else if (!tags.get(id)?.el.isConnected) {
        // Only forget the tag if it really left the page: a re-render can attach the new tag before
        // detaching the old one, and deleting then would leave the new tag unmanaged (overlapping).
        tags.delete(id);
      }
    },
    [tags, id, anchor],
  );
}

/** Every frame: measure the tags where they are, move any that overlap a nearer tag, ease them there. */
function TagLayout({ compact }: { compact: boolean }) {
  const tags = useContext(Tags);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, gl }) => {
    if (!tags || tags.size === 0) return;
    const stage = gl.domElement.getBoundingClientRect();
    const boxes = [...tags.entries()].map(([id, t]) => {
      const r = t.el.getBoundingClientRect();
      // Natural position = where it is now, minus the move we applied last frame.
      return { id, left: r.left - t.now.dx, right: r.right - t.now.dx, top: r.top + t.now.dy, bottom: r.bottom + t.now.dy, depth: t.anchor.getWorldPosition(v).distanceTo(camera.position), scale: r.width / Math.max(1, t.el.offsetWidth) };
    });
    const previous = new Map([...tags].map(([id, t]) => [id, t.target]));
    const shifts = placeLabels(boxes, { top: stage.top + 6, bottom: stage.bottom - 6, left: stage.left + 6, right: stage.right - 6 }, compact ? stage.height * 0.4 : 320, previous);
    for (const b of boxes) {
      const t = tags.get(b.id)!;
      t.target = shifts.get(b.id) ?? { dx: 0, dy: 0 };
      t.now = { dx: t.now.dx + (t.target.dx - t.now.dx) * 0.45, dy: t.now.dy + (t.target.dy - t.now.dy) * 0.45 };
      const k = b.scale || 1; // the tag sits inside a scaled Html wrapper
      const dx = t.now.dx / k;
      const dy = t.now.dy / k;
      t.el.style.transform = `translate(${dx}px, ${-dy}px)`;
      t.el.dataset.managed = "1";
      // Line from the tag's centre back to its seat (drawn behind the tag): length and angle of (-dx, +dy).
      const len = Math.hypot(dx, dy);
      t.line.style.height = `${len}px`;
      t.line.style.transform = `rotate(${Math.atan2(dx, dy)}rad)`;
    }
  });
  return null;
}

const TAG: Record<SeatState, string> = {
  empty: "",
  seated: "border-text/50 text-text",
  correct: "border-[#2BE36F] text-[#2BE36F] shadow-[0_0_28px_rgb(43_227_111/0.55)]",
  wrong: "border-red text-red shadow-[0_0_28px_rgb(255_59_92/0.55)]",
};

function Chair({
  number,
  occupant,
  state,
  leaving,
  position,
  rotationY,
  showPeople,
  reducedMotion,
  compact,
}: StageChair & { position: [number, number, number]; rotationY: number; showPeople: boolean; reducedMotion: boolean; compact: boolean }) {
  const { scene } = useGLTF(CHAIR_URL);
  const model = useMemo(() => withShadows(scene.clone(true)), [scene]);
  const group = useRef<Group>(null);
  const tagRef = useTagRef(`chair-${number}`, group);

  // Keep a person who just lost their seat on stage long enough to stand up and leave.
  const [ghost, setGhost] = useState<string | null>(null);
  const prev = useRef(occupant);
  useEffect(() => {
    if (prev.current && !occupant) {
      setGhost(prev.current);
      const t = setTimeout(() => setGhost(null), LEAVE_MS);
      prev.current = occupant;
      return () => clearTimeout(t);
    }
    if (occupant) setGhost(null);
    prev.current = occupant;
  }, [occupant]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    // Glide to a new seat when the ring is rebuilt; sink and shrink away when the admin removes the chair.
    const rate = reducedMotion ? 30 : 4;
    g.position.x = ease(g.position.x, position[0], rate, dt);
    g.position.z = ease(g.position.z, position[2], rate, dt);
    g.position.y = ease(g.position.y, leaving ? -1.2 : 0, leaving ? 2.2 : rate, dt);
    g.rotation.y = ease(g.rotation.y, rotationY, rate, dt);
    g.scale.setScalar(ease(g.scale.x, leaving ? 0.001 : 1, leaving ? 2.5 : rate, dt));
  });

  const shownState: SeatState = occupant ? state : "empty";
  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={model} />
      {showPeople && <NumberPlate number={number} />}
      {showPeople && <SeatLight state={shownState} />}
      {showPeople && occupant && <Person key={occupant} name={occupant} leaving={false} reducedMotion={reducedMotion} />}
      {showPeople && ghost && !occupant && <Person key={`ghost-${ghost}`} name={ghost} leaving reducedMotion={reducedMotion} />}
      {showPeople && occupant && !leaving && (
        // On a phone the tags keep one readable size instead of scaling with distance (they would cover the ring).
        <Html position={[0, 1.62, 0.05]} center distanceFactor={compact ? undefined : 7} zIndexRange={[20, 0]}>
          {/* Full name, up to two lines; TagLayout lifts it clear of nearer tags and draws a line to the seat. */}
          <div ref={tagRef} className="pointer-events-none relative flex flex-col items-center will-change-transform">
            <div
              data-name-tag
              className={`max-w-[12ch] rounded-[0.8em] border-2 bg-bg/90 px-[0.6em] py-[0.2em] text-center font-display ${compact ? "text-[11px]" : "text-[clamp(11px,0.95vw,22px)]"} leading-tight font-extrabold break-words transition-colors duration-300 ${TAG[shownState]}`}
            >
              {occupant}
            </div>
            <div className={`absolute top-1/2 left-1/2 -z-10 w-0.5 origin-top rounded-full opacity-70 ${shownState === "correct" ? "bg-[#2BE36F]" : shownState === "wrong" ? "bg-red" : "bg-text/60"}`} style={{ height: 0 }} />
          </div>
        </Html>
      )}
    </group>
  );
}

function Ring({ chairs, spinning, hidden, showPeople, reducedMotion, compact }: { chairs: StageChair[]; spinning: boolean; hidden: boolean; showPeople: boolean; reducedMotion: boolean; compact: boolean }) {
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
    speed.current = ease(speed.current, spinning && !reducedMotion ? 0.12 : 0, 1.5, dt);
    g.rotation.y += speed.current * dt;
    g.scale.setScalar(ease(g.scale.x, hidden ? 0.001 : 1, 2.5, dt));
  });

  return (
    <group ref={group}>
      {chairs.map((c) => {
        const seat = seats.get(c.number) ?? lastSeat.current.get(c.number) ?? { position: [0, 0, 0] as [number, number, number], rotationY: 0 };
        if (!c.leaving) lastSeat.current.set(c.number, seat);
        return <Chair key={c.number} {...c} position={seat.position} rotationY={seat.rotationY} showPeople={showPeople} reducedMotion={reducedMotion} compact={compact} />;
      })}
    </group>
  );
}

function Podium({ winners, visible, reducedMotion, compact }: { winners: { rank: number; name: string }[]; visible: boolean; reducedMotion: boolean; compact: boolean }) {
  const { nodes } = useGLTF(PODIUM_URL);
  const podium = useMemo(() => withShadows((nodes.Podium ?? new Object3D()).clone(true)), [nodes]);
  const trophy = useMemo(() => withShadows((nodes.Trophy ?? new Object3D()).clone(true)), [nodes]);
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
    <group ref={group} position={[0, -1.5, 0]}>
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
              <Html key={w.rank} position={[x, h + (w.rank === 1 ? 1.05 : 0.45), 0.1]} center distanceFactor={compact ? undefined : 5} zIndexRange={[20, 0]}>
                <div
                  className={`pointer-events-none text-center font-display font-extrabold ${compact ? "max-w-[10ch] leading-tight break-words" : "whitespace-nowrap"} ${w.rank === 1 ? (compact ? "text-xl" : "text-5xl") + " text-gold" : (compact ? "text-sm" : "text-3xl") + " text-text"} drop-shadow-[0_0_18px_rgb(0_0_0/0.9)]`}
                >
                  <div className={`${compact ? "text-[10px]" : "text-base"} tracking-[0.2em] text-muted`}>{w.rank === 1 ? "WINNER" : `#${w.rank}`}</div>
                  {w.name}
                </div>
              </Html>
            );
          })}
    </group>
  );
}

const CONFETTI = 320;
const CONFETTI_COLORS = [tokens.gold, tokens.cyan, tokens.red, tokens.text, tokens.lime];

/** One burst of falling, tumbling paper over the podium per `burstKey`. */
function Confetti({ burstKey }: { burstKey: number | null }) {
  const mesh = useRef<InstancedMesh>(null);
  const parts = useMemo(
    () => Array.from({ length: CONFETTI }, () => ({ p: new Vector3(), v: new Vector3(), spin: new Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6) })),
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
      pt.v.y -= 4.2 * step;
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
    <instancedMesh ref={mesh} args={[undefined, undefined, CONFETTI]} frustumCulled={false}>
      <planeGeometry args={[0.035, 0.055]} />
      <meshStandardMaterial side={2} roughness={0.5} metalness={0.3} />
    </instancedMesh>
  );
}

/**
 * Frames the whole ring to fill the viewport at any aspect ratio; eases to the podium close-up. With drag
 * controls (projector) the viewer chooses the angle and this only keeps the distance and target right.
 */
function CameraRig({ radius, podium, fov, interactive }: { radius: number; podium: boolean; fov: number; interactive: boolean }) {
  const { camera, size } = useThree();
  const controls = useThree((s) => s.controls) as unknown as { target: Vector3; update: () => void } | null;
  const look = useRef(new Vector3(0, 0.8, 0));
  useFrame((_, dt) => {
    const k = 1 - Math.exp(-1.6 * dt);
    const fit = fitCamera(radius, size.width / Math.max(size.height, 1), fov);
    const target = podium ? new Vector3(0, 0.75, 0) : new Vector3(...fit.target);
    if (interactive && controls) {
      controls.target.lerp(target, k);
      const want = podium ? 3.9 : new Vector3(...fit.position).distanceTo(new Vector3(...fit.target));
      const dir = camera.position.clone().sub(controls.target);
      const dist = dir.length();
      camera.position.copy(controls.target).add(dir.normalize().multiplyScalar(dist + (want - dist) * k));
      return;
    }
    const pos = podium ? new Vector3(0, 1.25, 3.6) : new Vector3(...fit.position);
    camera.position.lerp(pos, k);
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });
  return null;
}

const FOV = 38;
/** The polar angle fitCamera looks down from (26° above the horizon). */
const FIT_POLAR = Math.PI / 2 - (26 * Math.PI) / 180;

/** The live 3D stage: realistic chairs (and seated players on the projector) on a glossy floor under studio light. */
export default function StageScene({ chairs, spinning, podium, confettiKey, reducedMotion, showPeople = false, interactive = false, quality: initialQuality = "high", maxDpr = 2, compact = false }: Props) {
  const tags = useMemo(() => new Map<string, Tag>(), []);
  const [quality, setQuality] = useState(initialQuality);
  const high = quality === "high";
  const present = chairs.filter((c) => !c.leaving).length;
  const radius = stageRadius(present);
  const showPodium = podium !== null;
  const start = fitCamera(radius, 16 / 9, FOV);
  return (
    <Canvas
      shadows
      dpr={[1, maxDpr]}
      camera={{ position: start.position, fov: FOV, near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setQuality("low")} />
      <color attach="background" args={[tokens.bg]} />
      <fog attach="fog" args={[tokens.bg, radius * 3 + 6, radius * 6 + 16]} />

      {/* Studio reflections for wood, leather, skin, lacquer and gold; built from light panels, no downloads. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 5, -2]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[-5, 2, 2]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[5, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 2, 1]} />
        <Lightformer form="ring" color={tokens.amber} intensity={1.5} position={[0, 3, 6]} scale={3} />
      </Environment>
      <ambientLight intensity={0.1} />
      <spotLight
        position={[2.5, radius + 6, radius + 4]}
        angle={0.7}
        penumbra={0.8}
        intensity={110 + radius * 20}
        castShadow
        shadow-mapSize={high ? [2048, 2048] : [1024, 1024]}
        shadow-bias={-0.0002}
        color="#FFF1DC"
      />
      <spotLight position={[-radius - 3, 4, -radius - 3]} angle={0.8} penumbra={1} intensity={40} color={tokens.cyan} />

      <Tags.Provider value={tags}>
      <Suspense fallback={null}>
        <Ring chairs={chairs} spinning={spinning} hidden={showPodium} showPeople={showPeople} reducedMotion={reducedMotion} compact={compact} />
        {showPeople && <Podium winners={podium ?? []} visible={showPodium} reducedMotion={reducedMotion} compact={compact} />}
        {showPeople && !reducedMotion && <Confetti burstKey={confettiKey} />}
      </Suspense>
      {showPeople && <TagLayout compact={compact} />}
      </Tags.Provider>

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[radius + 10, 96]} />
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

      {interactive && (
        // Phones turn the ring only (tilt is locked at the framing angle), so a vertical swipe never fights the page.
        <OrbitControls
          makeDefault
          enableZoom={false}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={compact ? 0.8 : 0.55}
          minPolarAngle={compact ? FIT_POLAR : 0.25}
          maxPolarAngle={compact ? FIT_POLAR : 1.42}
          target={start.target}
        />
      )}
      <CameraRig radius={radius} podium={showPodium} fov={FOV} interactive={interactive} />
      {high && (
        <EffectComposer>
          <Bloom intensity={0.5} luminanceThreshold={0.8} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
  );
}

useGLTF.preload(CHAIR_URL);
