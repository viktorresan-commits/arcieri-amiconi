/**
 * Addestra il classificatore delle caselle dei cartellini (0, 5, 8) su cartellini veri trascritti a mano.
 * Uso: le foto in formato grezzo (larghezza, altezza, RGBA) e gli angoli della colonna di ogni arciere;
 * stampa la prova «lascia fuori un arciere» e scrive i pesi in pesi.json.
 */
import { readFileSync, writeFileSync } from "fs";
import { toGray, warp, gridLines, cellFeatures, classify, type Quad } from "../../src/lib/arcieri/scorecard-vision";

type Block = { name: string; f: string; q: Quad; truth: number[][] };
const load = (f: string) => { const b = readFileSync(f); const w = b.readUInt32LE(0), h = b.readUInt32LE(4); return { w, h, px: new Uint8Array(b.buffer, b.byteOffset + 8, w * h * 4) }; };
const parse = (s: string) => s.trim().split(/\s+/).map((r) => r.split(",").map((x) => (x === "/" ? 0 : Number(x))));
const blocks: Block[] = JSON.parse(readFileSync(process.argv[2], "utf8")).map((b: Block & { t: string }) => ({ ...b, truth: parse(b.t) }));
const cls = (v: number) => (v === 0 ? 0 : v === 5 ? 1 : 2);

type Ex = { x: number[]; y: number; block: string; empty: boolean };
const data: Ex[] = [];
const imgs = new Map<string, ReturnType<typeof toGray>>();
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
for (const b of blocks) {
  if (!imgs.has(b.f)) { const im = load(b.f); imgs.set(b.f, toGray(im.px, im.w, im.h)); }
  const g = imgs.get(b.f)!;
  for (let a = 0; a < 6; a++) {
    // angoli spostati di qualche punto: come li mette un dito
    const q = b.q.map(([x, y]) => [x + (a ? rnd() * 5 : 0), y + (a ? rnd() * 5 : 0)]) as Quad;
    const rect = warp(g, q, 480, 920);
    const { xs, ys } = gridLines(rect);
    for (let i = 0; i < 20; i++)
      for (let c = 1; c <= 3; c++) {
        const { f } = cellFeatures(rect, xs[c], ys[i], xs[c + 1], ys[i + 1]);
        data.push({ x: f ?? [], y: cls(b.truth[i][c - 1]), block: b.name, empty: !f });
      }
  }
}
const D = data.find((d) => !d.empty)!.x.length;
function train(ex: Ex[], l2 = 0.02, it = 1500, lr = 0.5) {
  const W = [0, 1, 2].map(() => new Array(D + 1).fill(0));
  const xs = ex.filter((e) => !e.empty);
  for (let t = 0; t < it; t++) {
    const G = [0, 1, 2].map(() => new Array(D + 1).fill(0));
    for (const e of xs) {
      const p = classify(e.x, W);
      for (let k = 0; k < 3; k++) {
        const err = p[k] - (e.y === k ? 1 : 0);
        for (let i = 0; i < D; i++) G[k][i] += err * e.x[i];
        G[k][D] += err;
      }
    }
    for (let k = 0; k < 3; k++) for (let i = 0; i <= D; i++) W[k][i] -= lr * (G[k][i] / xs.length + (i < D ? l2 * W[k][i] : 0));
  }
  return W;
}
const acc = (W: number[][], ex: Ex[]) => {
  let ok = 0;
  for (const e of ex) {
    const p = e.empty ? [1, 0, 0] : classify(e.x, W);
    const b = p[0] >= p[1] && p[0] >= p[2] ? 0 : p[1] >= p[2] ? 1 : 2;
    if (b === e.y) ok++;
  }
  return `${ok}/${ex.length}`;
};
for (const b of blocks) {
  const W = train(data.filter((e) => e.block !== b.name));
  console.log("senza", b.name, "->", acc(W, data.filter((e) => e.block === b.name)));
}
const W = train(data);
console.log("tutti", acc(W, data));
writeFileSync(process.argv[3] ?? "pesi.json", JSON.stringify(W.map((r) => r.map((v) => +v.toFixed(4)))));
