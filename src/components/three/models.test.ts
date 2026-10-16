import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MODELS = join(process.cwd(), "public/models");
// Extensions three's GLTFLoader handles without a decoder (no Draco/meshopt wasm, so the CSP stays strict: D-019).
const LOADER_NATIVE = new Set(["EXT_texture_webp", "KHR_materials_clearcoat", "KHR_materials_sheen", "KHR_materials_specular", "KHR_texture_transform"]);

type Gltf = {
  nodes: { name: string }[];
  materials: { name: string; pbrMetallicRoughness?: { baseColorTexture?: unknown } }[];
  images?: { mimeType: string }[];
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number }[] }[];
  accessors: { count: number }[];
};

function readGlb(file: string): Gltf {
  const b = readFileSync(join(MODELS, file));
  expect(b.toString("ascii", 0, 4)).toBe("glTF");
  expect(b.readUInt32LE(4)).toBe(2);
  const len = b.readUInt32LE(12);
  expect(b.toString("ascii", 16, 20)).toBe("JSON");
  return JSON.parse(b.toString("utf8", 20, 20 + len)) as Gltf;
}

const triangles = (g: Gltf) =>
  g.meshes.flatMap((m) => m.primitives).reduce((n, p) => n + (p.indices !== undefined ? g.accessors[p.indices].count : g.accessors[p.attributes.POSITION].count) / 3, 0);

describe("Blender models (T-701)", () => {
  for (const file of ["chair.glb", "podium.glb"]) {
    it(`${file} is a glTF 2.0 binary under 1 MB that loads without a decoder`, () => {
      expect(statSync(join(MODELS, file)).size).toBeLessThan(1_000_000);
      const g = readGlb(file);
      for (const ext of [...(g.extensionsUsed ?? []), ...(g.extensionsRequired ?? [])]) expect(LOADER_NATIVE.has(ext)).toBe(true);
      expect(g.extensionsUsed ?? []).not.toContain("KHR_draco_mesh_compression");
    });
  }

  it("the chair is a realistic textured model: walnut frame and leather seat with baked WebP maps", () => {
    const g = readGlb("chair.glb");
    expect(g.materials.map((m) => m.name).sort()).toEqual(["LeatherBaked", "Walnut"]);
    expect(g.materials.every((m) => m.pbrMetallicRoughness?.baseColorTexture)).toBe(true);
    expect(g.images?.every((i) => i.mimeType === "image/webp")).toBe(true);
    expect(triangles(g)).toBeLessThan(15_000); // stays light enough for 30+ chairs on stage
  });

  it("the podium ships the Podium and Trophy as separate nodes so the trophy can rise and turn", () => {
    const g = readGlb("podium.glb");
    expect(g.nodes.map((n) => n.name)).toEqual(expect.arrayContaining(["Podium", "Trophy"]));
    expect(g.materials.map((m) => m.name)).toEqual(expect.arrayContaining(["BlackLacquer", "BrushedGold", "PolishedGold", "Carrara", "Nero"]));
  });
});
