/**
 * Per scripts/anatomia/wrap_skin.py: le ossa del personaggio Quaternius messe nel riposo dell'atlante, con lo
 * stesso codice dell'app (bodyBones di src/lib/arcieri/skin-body.ts, segmenti dell'atlante fermi).
 * Le ossa della mano restano ferme (nell'app arrivano dalla presa): wrap_skin.py le mette sull'avambraccio.
 *
 *   esbuild scripts/anatomia/wrap_rest.ts --bundle --platform=node --format=esm --alias:@=./src --outfile=/tmp/wrap_rest.mjs
 *   node /tmp/wrap_rest.mjs public/anatomia/corpo.json <pelle.json originale> > rest-bones.json
 */
import fs from "node:fs";
import { bodyBones, type SkinBody } from "@/lib/arcieri/skin-body";

const [metaPath, pellePath] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const pj = JSON.parse(fs.readFileSync(pellePath, "utf8")) as { joints: { name: string; parent: number; rest: number[] }[] };
const sb = { names: pj.joints.map((j) => j.name), heads: pj.joints.map((j) => [j.rest[12], j.rest[13], j.rest[14]]), parent: pj.joints.map((j) => j.parent) } as unknown as SkinBody;
const n = meta.segments.length;
const I = new Float32Array(n * 16);
for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) I[i * 16 + k * 5] = 1;
process.stdout.write(JSON.stringify({ names: sb.names, bones: bodyBones(meta, sb, I, []) }));
