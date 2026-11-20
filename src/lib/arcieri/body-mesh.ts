/**
 * Corpo realistico dell'arciere: mesh con pelle e abiti, pesata su 16 ossa e mossa con le stesse
 * pose del tiro. Il file nasce da un personaggio Fuse/Mixamo convertito nel formato dell'app
 * (non è distribuito come modello a parte).
 */
import { hexRgb, v3, type GL3D, type SkinGeo, type SkinMesh, type Vec3 } from "./gl3d";

type Header = {
  count: number;
  indices: number;
  lo: number[];
  hi: number[];
  groups: { mat: string; start: number; count: number }[];
  bones: { name: string; a: Vec3; b: Vec3 }[];
  joints: Record<string, Vec3>;
};

export type BodyAsset = { header: Header; geo: SkinGeo };

let assetPromise: Promise<BodyAsset> | null = null;

export function loadBodyAsset() {
  assetPromise ??= fetch("/models/archer-body.bin")
    .then((r) => {
      if (!r.ok) throw new Error("modello");
      return r.arrayBuffer();
    })
    .then((buf) => {
      const dv = new DataView(buf);
      const hl = dv.getUint32(0, true);
      const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as Header;
      let off = 4 + hl;
      const take = <T extends ArrayBufferView>(make: (b: ArrayBuffer, o: number, n: number) => T, n: number, bytes: number) => {
        const arr = make(buf, off, n);
        off += bytes;
        off += (4 - (off % 4)) % 4;
        return arr;
      };
      const n = header.count;
      const q = take((b, o, k) => new Uint16Array(b, o, k), n * 3, n * 6);
      const nq = take((b, o, k) => new Int8Array(b, o, k), n * 4, n * 4);
      const uq = take((b, o, k) => new Uint16Array(b, o, k), n * 2, n * 4);
      const bq = take((b, o, k) => new Uint8Array(b, o, k), n * 4, n * 4);
      const wq = take((b, o, k) => new Uint8Array(b, o, k), n * 4, n * 4);
      const iq = take((b, o, k) => new Uint16Array(b, o, k), header.indices, header.indices * 2);
      const pos = new Float32Array(n * 3);
      const nor = new Float32Array(n * 3);
      const uv = new Float32Array(n * 2);
      const bone = new Float32Array(n * 4);
      const w = new Float32Array(n * 4);
      const { lo, hi } = header;
      for (let i = 0; i < n; i += 1) {
        for (let c = 0; c < 3; c += 1) {
          pos[i * 3 + c] = lo[c] + (q[i * 3 + c] / 65535) * (hi[c] - lo[c]);
          nor[i * 3 + c] = nq[i * 4 + c] / 127;
        }
        uv[i * 2] = uq[i * 2] / 65535;
        uv[i * 2 + 1] = 1 - uq[i * 2 + 1] / 65535;
        for (let c = 0; c < 4; c += 1) {
          bone[i * 4 + c] = bq[i * 4 + c];
          w[i * 4 + c] = wq[i * 4 + c] / 255;
        }
      }
      return { header, geo: { pos, nor, uv, bone, w, idx: new Uint16Array(iq) } };
    });
  return assetPromise;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export type BodyRes = { ready: boolean; failed: boolean; asset: BodyAsset | null; mesh: SkinMesh | null; tex: Record<string, WebGLTexture> };

/** Risorse del corpo per questa tela (caricate una volta, poi pronte). */
export function bodyRes(g: GL3D): BodyRes {
  return g.once("real-body", () => {
    const res: BodyRes = { ready: false, failed: false, asset: null, mesh: null, tex: {} };
    Promise.all([loadBodyAsset(), ...["body", "top", "bottom", "shoes"].map((n) => loadImage(`/models/archer-${n}.jpg`))])
      .then(([asset, ...imgs]) => {
        res.asset = asset as BodyAsset;
        res.mesh = g.skinnedMesh((asset as BodyAsset).geo);
        ["body", "top", "bottom", "shoes"].forEach((n, i) => (res.tex[n] = g.textureFrom(imgs[i] as HTMLImageElement, true, false)));
        res.ready = true;
      })
      .catch(() => {
        res.failed = true;
      });
    return res;
  });
}

// ── pose → matrici delle ossa ─────────────────────────────────────────────────
type M3 = [Vec3, Vec3, Vec3]; // colonne: asse X, Y, Z

function frame(x: Vec3, hintY: Vec3): M3 {
  const X = v3.norm(x);
  let Z = v3.cross(X, hintY);
  if (v3.len(Z) < 1e-5) Z = v3.cross(X, Math.abs(X[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]);
  Z = v3.norm(Z);
  const Y = v3.cross(Z, X);
  return [X, Y, Z];
}

/** Matrice 4×4 (colonne) che porta il punto a riposo `ra` con la base `R` nel punto `pa` con la base `P`, allungando l'asse X di `sx` e il resto di `s`. */
function boneMatrix(out: Float32Array, o: number, ra: Vec3, R: M3, pa: Vec3, P: M3, sx: number, s: number) {
  // M = T(pa) · P · diag(sx,s,s) · Rᵀ · T(−ra)
  const sc = [sx, s, s];
  const A: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sum = 0;
      for (let k = 0; k < 3; k += 1) sum += P[k][r] * sc[k] * R[k][c];
      A[r][c] = sum;
    }
  }
  const t: Vec3 = [pa[0] - (A[0][0] * ra[0] + A[0][1] * ra[1] + A[0][2] * ra[2]), pa[1] - (A[1][0] * ra[0] + A[1][1] * ra[1] + A[1][2] * ra[2]), pa[2] - (A[2][0] * ra[0] + A[2][1] * ra[1] + A[2][2] * ra[2])];
  out.set([A[0][0], A[1][0], A[2][0], 0, A[0][1], A[1][1], A[2][1], 0, A[0][2], A[1][2], A[2][2], 0, t[0], t[1], t[2], 1], o * 16);
}

export type RealPose = {
  /** origine dei piedi nel mondo e assi del corpo: F petto, U su, L sinistra (verso il bersaglio) */
  origin: Vec3;
  F: Vec3;
  L: Vec3;
  s: number;
  /** mani: posizione della presa (mondo) e verso cui piegare i gomiti */
  lHand: Vec3;
  rHand: Vec3;
  lPole: Vec3;
  rPole: Vec3;
  /** viso: direzione dello sguardo */
  face: Vec3;
  /** busto: piccola rotazione verso il bersaglio (radianti) e inclinazione in avanti */
  twist?: number;
  lean?: number;
};

export type RealJoints = Record<"pelvis" | "chest" | "neck" | "head" | "lSh" | "rSh" | "lEl" | "rEl" | "lWr" | "rWr" | "lHand" | "rHand" | "lHip" | "rHip" | "lKnee" | "rKnee" | "lAnk" | "rAnk", Vec3>;

/**
 * Calcola le 16 matrici delle ossa e le articolazioni nel mondo. Il busto è rigido (bacino, schiena,
 * petto); braccia e gambe sono catene a due ossa risolte verso mani e piedi.
 */
export function solveBody(h: Header, p: RealPose, out = new Float32Array(256)): RealJoints {
  const J = h.joints;
  const U: Vec3 = [0, 1, 0];
  const s = p.s;
  // assi del busto, con piccola rotazione verso il bersaglio
  const tw = p.twist ?? 0;
  const Fb = v3.norm(v3.add(v3.scale(p.F, Math.cos(tw)), v3.scale(p.L, Math.sin(tw))));
  const Lb = v3.norm(v3.cross(U, Fb));
  const lean = p.lean ?? 0;
  const Ub = v3.norm(v3.add(U, v3.scale(Fb, lean)));
  // modello: +X sinistra, +Y su, +Z avanti
  const W = (q: Vec3, base: Vec3, rest: Vec3, X: Vec3, Y: Vec3, Z: Vec3): Vec3 => {
    const d = v3.sub(q, rest);
    return v3.add(base, v3.add(v3.scale(X, d[0] * s), v3.add(v3.scale(Y, d[1] * s), v3.scale(Z, d[2] * s))));
  };
  const hipRest: Vec3 = J.pelvis;
  const pelvisP: Vec3 = v3.add(p.origin, v3.scale(U, hipRest[1] * s));
  const Wp = (q: Vec3) => W(q, pelvisP, hipRest, Lb, U, v3.norm(v3.cross(Lb, U)));
  const Wc = (q: Vec3) => W(q, pelvisP, hipRest, Lb, Ub, v3.norm(v3.cross(Lb, Ub)));
  const I: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const pelvisF: M3 = [Lb, U, v3.norm(v3.cross(Lb, U))];
  const chestF: M3 = [Lb, Ub, v3.norm(v3.cross(Lb, Ub))];
  boneMatrix(out, 0, hipRest, I, pelvisP, pelvisF, s, s);
  boneMatrix(out, 1, hipRest, I, pelvisP, chestF, s, s);
  boneMatrix(out, 2, hipRest, I, pelvisP, chestF, s, s);
  // testa: guarda dove indica `face`
  const neckP = Wc(J.neck);
  const faceH = v3.norm(v3.sub(p.face, v3.scale(Ub, v3.dot(p.face, Ub))));
  const headX = v3.norm(v3.cross(Ub, faceH));
  boneMatrix(out, 3, J.neck, I, neckP, [headX, Ub, faceH], s, s);

  const chain = (bi: number, sh: Vec3, el: Vec3, wr: Vec3, tip: Vec3, target: Vec3, pole: Vec3, restFlex: Vec3, shW: Vec3) => {
    const l1 = v3.len(v3.sub(el, sh)) * s;
    const l2 = v3.len(v3.sub(wr, el)) * s;
    const lh = v3.len(v3.sub(tip, wr)) * s * 0.42; // presa a metà mano
    const d = v3.sub(target, shW);
    const reach = l1 + l2 + lh;
    const dist = Math.max(0.02, Math.min(reach * 0.999, v3.len(d)));
    const dir = v3.norm(d);
    // la presa è lh oltre il polso lungo l'avambraccio: risolvo il gomito con l2+lh
    const L2 = l2 + lh;
    const a = (l1 * l1 - L2 * L2 + dist * dist) / (2 * dist);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    let perp = v3.sub(pole, v3.scale(dir, v3.dot(pole, dir)));
    if (v3.len(perp) < 1e-5) perp = [0, 1, 0];
    perp = v3.norm(perp);
    const elW = v3.add(v3.add(shW, v3.scale(dir, a)), v3.scale(perp, hh));
    const grip = v3.add(shW, v3.scale(dir, dist));
    const foreDir = v3.norm(v3.sub(grip, elW));
    const wrW = v3.add(elW, v3.scale(foreDir, l2));
    const upDir = v3.norm(v3.sub(elW, shW));
    // piano del gomito: la flessione va verso l'avambraccio, opposta al polo
    let flex = v3.sub(foreDir, v3.scale(upDir, v3.dot(foreDir, upDir)));
    if (v3.len(flex) < 0.05) flex = v3.scale(perp, -1);
    const restUp = v3.sub(el, sh);
    const restFore = v3.sub(wr, el);
    const Rup = frame(restUp, restFlex);
    const Rfore = frame(restFore, restFlex);
    const Pup = frame(upDir, flex);
    // l'avambraccio usa lo stesso piano: la sua Y punta lontano dal braccio
    const PforeFix: M3 = (() => {
      const n = Pup[2];
      const X = foreDir;
      const Y = v3.norm(v3.cross(n, X));
      return [X, Y, n];
    })();
    boneMatrix(out, bi, sh, Rup, shW, Pup, (v3.len(v3.sub(elW, shW)) / v3.len(restUp)), s);
    boneMatrix(out, bi + 1, el, Rfore, elW, PforeFix, l2 / v3.len(restFore), s);
    boneMatrix(out, bi + 2, wr, Rfore, wrW, PforeFix, s, s);
    return { el: elW, wr: wrW, grip };
  };

  const lShW = Wc(J.lSh);
  const rShW = Wc(J.rSh);
  const flexArm: Vec3 = [0, 0, 1];
  const lArm = chain(4, J.lSh, J.lEl, J.lWr, J.lTip, p.lHand, p.lPole, flexArm, lShW);
  const rArm = chain(7, J.rSh, J.rEl, J.rWr, J.rTip, p.rHand, p.rPole, flexArm, rShW);
  // gambe: piedi a terra, ginocchia leggermente in avanti
  const lHipW = Wp(J.lHip);
  const rHipW = Wp(J.rHip);
  const Fh = v3.norm(v3.cross(Lb, U));
  const footL = v3.add(p.origin, v3.add(v3.scale(Lb, (J.lAnk[0] + 0.045) * s), v3.scale(U, J.lAnk[1] * s)));
  const footR = v3.add(p.origin, v3.add(v3.scale(Lb, (J.rAnk[0] - 0.045) * s), v3.scale(U, J.rAnk[1] * s)));
  const lLeg = chain(10, J.lHip, J.lKnee, J.lAnk, J.lToe, v3.add(footL, v3.scale(v3.norm(v3.sub(footL, lHipW)), v3.len(v3.sub(J.lToe, J.lAnk)) * s * 0.42)), Fh, [0, 0, -1], lHipW);
  const rLeg = chain(13, J.rHip, J.rKnee, J.rAnk, J.rToe, v3.add(footR, v3.scale(v3.norm(v3.sub(footR, rHipW)), v3.len(v3.sub(J.rToe, J.rAnk)) * s * 0.42)), Fh, [0, 0, -1], rHipW);
  // i piedi restano piatti, orientati come il bacino
  const footFrame: M3 = [Lb, U, Fh];
  boneMatrix(out, 12, J.lAnk, I, lLeg.wr, footFrame, s, s);
  boneMatrix(out, 15, J.rAnk, I, rLeg.wr, footFrame, s, s);
  return {
    pelvis: pelvisP,
    chest: Wc(J.chest),
    neck: neckP,
    head: v3.add(neckP, v3.scale(Ub, 0.15 * s)),
    lSh: lShW,
    rSh: rShW,
    lEl: lArm.el,
    rEl: rArm.el,
    lWr: lArm.wr,
    rWr: rArm.wr,
    lHand: lArm.grip,
    rHand: rArm.grip,
    lHip: lHipW,
    rHip: rHipW,
    lKnee: lLeg.el,
    rKnee: rLeg.el,
    lAnk: lLeg.wr,
    rAnk: rLeg.wr,
  };
}

const SKIN_REF = hexRgb("#d9a383");

/** Disegna il corpo realistico con i colori dell'avatar. */
export function drawRealBody(g: GL3D, res: BodyRes, bones: Float32Array, look: { skin?: string; shirt?: string; pants?: string; shoes?: string }) {
  if (!res.ready || !res.mesh || !res.asset) return false;
  const skin = hexRgb(look.skin || "#eec5a4");
  const ratio: Vec3 = [Math.min(1.6, skin[0] / SKIN_REF[0]), Math.min(1.6, skin[1] / SKIN_REF[1]), Math.min(1.6, skin[2] / SKIN_REF[2])];
  const parts = res.asset.header.groups.map((gr) => {
    if (gr.mat === "Body") return { ...gr, tex: res.tex.body, color: ratio, tint: 0 as const, shine: 0.16 };
    if (gr.mat === "Eyes") return { ...gr, tex: res.tex.body, color: [1, 1, 1] as Vec3, tint: 0 as const, shine: 0.9 };
    if (gr.mat === "Top") return { ...gr, tex: res.tex.top, color: hexRgb(look.shirt || "#2f6f62"), tint: 1 as const, shine: 0.1 };
    if (gr.mat === "Bottom") return { ...gr, tex: res.tex.bottom, color: hexRgb(look.pants || "#2b3440"), tint: 1 as const, shine: 0.08 };
    return { ...gr, tex: res.tex.shoes, color: [1, 1, 1] as Vec3, tint: 0 as const, shine: 0.2 };
  });
  g.drawSkinned(res.mesh, bones, parts);
  return true;
}
