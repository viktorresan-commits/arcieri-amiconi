import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, ErrorNote, PageHead, cx } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { ArcherFront } from "@/components/archer-front";
import { SceneBackdrop } from "@/components/scene-2d";
import { useAvatar, useTeamAvatars } from "@/components/avatar-hero";
import { useMember } from "@/components/shell";
import { useSky } from "@/lib/arcieri/sky3d";
import { useLoad } from "@/lib/arcieri/use-load";
import { archerBoard } from "@/lib/arcieri/club.api";
import { listRoster } from "@/lib/arcieri/members.api";
import { sceneById } from "@/lib/arcieri/scenes";
import { levelOf } from "@/lib/arcieri/xp";
import { isNativeApp, saveFile } from "@/lib/arcieri/native";
import { svgImage } from "@/lib/arcieri/svg-raster";
import { demonScale } from "@/components/demon-costume";
import type { AvatarLook } from "@/lib/arcieri/avatar";

/**
 * Storie da condividere (1080 × 1920, come le storie di Instagram e WhatsApp):
 * - «Foto insieme»: il proprio arciere e quello di un compagno, uno accanto all'altro nella scena scelta;
 * - «Il mio video»: dieci secondi con il proprio arciere e i propri numeri che salgono uno alla volta.
 * Tutto si disegna sul telefono: gli arcieri e la scena (SVG) diventano immagini su un canvas.
 */
export const Route = createFileRoute("/_app/storia")({
  validateSearch: (search: Record<string, unknown>): { con?: string; modo?: "foto" | "video" } => ({
    ...(typeof search.con === "string" && search.con ? { con: search.con } : {}),
    ...(search.modo === "video" || search.modo === "foto" ? { modo: search.modo } : {}),
  }),
  component: Page,
});

const W = 1080;
const H = 1920;
/** la figura di fronte: viewBox 200 × 370 */
const FIG_W = 200;
const FIG_H = 370;

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
const fonts = () => ({ disp: cssVar("--font-disp", "'Barlow Condensed', Impact, sans-serif"), app: cssVar("--font-app", "Outfit, sans-serif") });
const num = (v: number, d = 0) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
const ease = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** testo che non sfora: rimpicciolisce fino a stare nella larghezza */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, size: number, family: string, weight = "700") {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 18) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  ctx.fillText(text, x, y);
}

/** velatura sopra e sotto per leggere i testi, e il nome dell'app in fondo */
function frame(ctx: CanvasRenderingContext2D, f: { disp: string; app: string }) {
  const top = ctx.createLinearGradient(0, 0, 0, 520);
  top.addColorStop(0, "rgba(0,0,0,0.72)");
  top.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 520);
  const bot = ctx.createLinearGradient(0, H - 380, 0, H);
  bot.addColorStop(0, "rgba(0,0,0,0)");
  bot.addColorStop(1, "rgba(0,0,0,0.78)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, H - 380, W, 380);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.86)";
  ctx.font = `600 34px ${f.app}`;
  ctx.fillText("Arcieri Amiconi", W / 2, H - 84);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = `500 26px ${f.app}`;
  ctx.fillText("arcieri-amiconi.vercel.app", W / 2, H - 46);
}

/** ombra a terra sotto i piedi */
function groundShadow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  const g = ctx.createRadialGradient(x, y, 4, x, y, w);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.scale(1, 0.18);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y / 0.18, w, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** aspetta che React abbia disegnato (due fotogrammi) */
const painted = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

type People = { userId: string; name: string; first: string }[];

function Page() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"foto" | "video">(search.modo ?? "foto");
  const member = useMember();
  const me = member.me;
  const myName = [me.givenName, me.familyName].filter(Boolean).join(" ").trim() || me.nickname || "Io";
  const { shown } = useAvatar();
  const looks = useTeamAvatars();
  const roster = useLoad("storia-roster", () => listRoster());
  // i compagni con un arciere disegnato, in ordine di nome
  const people: People = useMemo(
    () =>
      (roster.data ?? [])
        .filter((m) => m.userId && m.userId !== me.userId && looks[m.userId])
        .map((m) => {
          const name = [m.givenName, m.familyName].filter(Boolean).join(" ").trim() || m.nickname || "Arciere";
          return { userId: m.userId as string, name, first: (m.givenName || m.nickname || name).split(" ")[0] };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "it")),
    [roster.data, looks, me.userId],
  );
  return (
    <div className="grid gap-3">
      <PageHead kicker="Profilo" title="Storie da condividere" lede="Una foto del tuo arciere con un compagno, o un video con i tuoi numeri: verticale, pronta per le storie di Instagram e WhatsApp." />
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-white/[0.05] p-1">
        {([["foto", "Foto insieme", "camera"], ["video", "Il mio video", "play"]] as const).map(([id, label, icon]) => (
          <button key={id} type="button" aria-pressed={mode === id} onClick={() => setMode(id)} className={cx("flex min-h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold", mode === id ? "bg-primary text-primary-fg shadow" : "text-muted")}>
            <Glyph name={icon} size={16} /> {label}
          </button>
        ))}
      </div>
      {mode === "foto" ? (
        <PhotoTogether me={{ userId: me.userId ?? "", name: myName, first: (me.givenName || me.nickname || myName).split(" ")[0] }} myLook={shown} people={people} looks={looks} start={search.con} loading={roster.loading} />
      ) : (
        <StatsVideo memberId={me.id} name={myName} look={shown} />
      )}
    </div>
  );
}

/* ---------------- Foto insieme ---------------- */

function PhotoTogether({ me, myLook, people, looks, start, loading }: { me: People[number]; myLook: AvatarLook; people: People; looks: Record<string, AvatarLook>; start?: string; loading: boolean }) {
  const { sky } = useSky();
  const [friendId, setFriendId] = useState(start ?? "");
  const friend = people.find((p) => p.userId === friendId) ?? null;
  const friendLook = friend ? looks[friend.userId] : null;
  const [sceneOf, setSceneOf] = useState<"mia" | "sua">("mia");
  const scene = sceneOf === "sua" && friendLook ? friendLook.scene : myLook.scene;
  const [query, setQuery] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // la foto si ridisegna quando cambiano compagno, scena o aspetto
  useEffect(() => {
    let off = false;
    setReady(false);
    setErr("");
    void (async () => {
      await painted();
      const host = stage.current;
      const ctx = canvas.current?.getContext("2d");
      if (!host || !ctx || off) return;
      const bgSvg = host.querySelector<SVGSVGElement>("[data-part=bg] svg");
      const meSvg = host.querySelector<SVGSVGElement>("[data-part=me] > svg");
      const frSvg = host.querySelector<SVGSVGElement>("[data-part=friend] > svg");
      try {
        // con le corna la figura si rimpicciolisce per stare nel riquadro: qui si riporta alla statura vera
        // e se le corna arrivano ai titoli, tutti e due un po' più piccoli (le proporzioni restano)
        const tallest = Math.max(1 / demonScale(myLook), friendLook ? 1 / demonScale(friendLook) : 0);
        const fitK = Math.min(1, (1640 - 340) / (1240 * tallest));
        const size = (l: AvatarLook | null) => {
          const h = (1240 * fitK) / demonScale(l ?? myLook);
          return { h, w: (h * FIG_W) / FIG_H };
        };
        const sa = size(myLook);
        const sb = size(friendLook);
        const [bg, a, b] = await Promise.all([bgSvg ? svgImage(bgSvg, W, H) : null, meSvg ? svgImage(meSvg, sa.w, sa.h) : null, frSvg ? svgImage(frSvg, sb.w, sb.h) : null]);
        const doc = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
        if (doc) await doc.ready;
        if (off) return;
        const f = fonts();
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = "#0c0a08";
        ctx.fillRect(0, 0, W, H);
        if (bg) ctx.drawImage(bg, 0, 0, W, H);
        // i due arcieri, un po' accostati: il compagno a destra
        const feet = 1640;
        const xs = b ? [W * 0.31, W * 0.69] : [W * 0.5];
        xs.forEach((x) => groundShadow(ctx, x, feet - 14, 230));
        if (a) ctx.drawImage(a, xs[0] - sa.w / 2, feet - sa.h, sa.w, sa.h);
        if (b) ctx.drawImage(b, xs[1] - sb.w / 2, feet - sb.h, sb.w, sb.h);
        frame(ctx, f);
        // titolo: i due nomi e la scena
        ctx.textAlign = "center";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 18;
        fitText(ctx, friend ? `${me.first} & ${friend.first}` : me.name, W / 2, 190, W - 120, 120, f.disp, "700");
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#f1cf8a";
        ctx.font = `600 38px ${f.app}`;
        ctx.fillText(sceneById(scene).label, W / 2, 256);
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = `500 32px ${f.app}`;
        ctx.fillText(new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }), W / 2, 306);
        // i nomi sotto i piedi
        ctx.font = `700 40px ${f.disp}`;
        const tag = (text: string, x: number) => {
          const w = ctx.measureText(text).width + 44;
          ctx.fillStyle = "rgba(0,0,0,0.55)";
          roundRect(ctx, x - w / 2, feet + 34, w, 58, 29);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillText(text, x, feet + 76);
        };
        tag(me.name, xs[0]);
        if (friend && xs[1]) tag(friend.name, xs[1]);
        setReady(true);
      } catch (e) {
        if (!off) setErr(e instanceof Error ? e.message : "Foto non riuscita.");
      }
    })();
    return () => {
      off = true;
    };
  }, [friendId, scene, myLook, friendLook, me.name, me.first, friend]);

  async function share() {
    if (!canvas.current) return;
    setBusy(true);
    setMsg("");
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.current?.toBlob(r, "image/png"));
      if (!blob) throw new Error("Immagine non creata.");
      const name = `arcieri-${me.first}${friend ? `-${friend.first}` : ""}.png`.toLowerCase();
      await shareFile(blob, name, friend ? `${me.first} e ${friend.first} su Arcieri Amiconi` : `${me.first} su Arcieri Amiconi`, setMsg);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setMsg(e instanceof Error ? e.message : "Non condivisa");
    } finally {
      setBusy(false);
    }
  }

  const shownPeople = people.filter((p) => !query.trim() || p.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <div className="grid gap-3">
      <Card className="grid gap-2">
        <p className="text-sm font-semibold">Con chi fai la foto?</p>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca un compagno" className="min-h-11 rounded-xl border border-hair bg-white/[0.04] px-3 text-sm" />
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => setFriendId("")} aria-pressed={!friendId} className={cx("aa-chip shrink-0", !friendId && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>Solo io</button>
          {shownPeople.map((p) => (
            <button key={p.userId} type="button" onClick={() => setFriendId(p.userId)} aria-pressed={friendId === p.userId} className={cx("aa-chip shrink-0", friendId === p.userId && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>{p.name}</button>
          ))}
        </div>
        {loading ? <p className="text-xs text-muted">Carico i compagni…</p> : !people.length ? <p className="text-xs text-muted">Nessun compagno ha ancora disegnato il suo arciere.</p> : null}
        {friend ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted">Scena:</span>
            {([["mia", `la mia (${sceneById(myLook.scene).label})`], ["sua", `quella di ${friend.first} (${sceneById(friendLook?.scene).label})`]] as const).map(([id, label]) => (
              <button key={id} type="button" aria-pressed={sceneOf === id} onClick={() => setSceneOf(id)} className={cx("aa-chip text-xs", sceneOf === id && "border-[#e0b15a]/60 bg-[#e0b15a]/15 text-[#f1cf8a]")}>{label}</button>
            ))}
          </div>
        ) : null}
      </Card>
      <Card className="grid place-items-center !p-3">
        <canvas ref={canvas} width={W} height={H} className={cx("h-auto w-full max-w-[22rem] rounded-[1.4rem] shadow-card transition-opacity", ready ? "opacity-100" : "opacity-40")} aria-label="Anteprima della foto da condividere" />
      </Card>
      {err ? <ErrorNote text={err} /> : null}
      <Button onClick={() => void share()} disabled={busy || !ready}>
        <Glyph name="share" size={18} className="mr-2" /> {busy ? "Preparo la foto…" : "Condividi la foto"}
      </Button>
      {msg ? <p className="text-center text-sm text-muted">{msg}</p> : null}
      {/* fuori schermo: i disegni da cui nasce la foto */}
      <div ref={stage} aria-hidden className="pointer-events-none fixed left-[-6000px] top-0 h-[960px] w-[540px] overflow-hidden">
        <div data-part="bg" className="relative h-[960px] w-[540px]">
          <SceneBackdrop sky={sky} id="storia-bg" scene={scene} />
        </div>
        <div data-part="me"><ArcherFront look={{ ...myLook, lefty: Boolean(friendLook) }} crop={`0 0 ${FIG_W} ${FIG_H}`} className="h-[370px] w-[200px]" /></div>
        {friendLook ? <div data-part="friend"><ArcherFront look={{ ...friendLook, lefty: false }} crop={`0 0 ${FIG_W} ${FIG_H}`} className="h-[370px] w-[200px]" /></div> : null}
      </div>
    </div>
  );
}

/** condivide il file (foglio «Condividi» del telefono) o lo scarica */
async function shareFile(blob: Blob, name: string, text: string, setMsg: (m: string) => void) {
  const file = new File([blob], name, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (!isNativeApp() && nav.canShare?.({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], text });
  } else {
    await saveFile(blob, name);
    if (!isNativeApp()) setMsg("File scaricato: lo trovi nei download, pronto da pubblicare.");
  }
}

/* ---------------- Il mio video ---------------- */

type Stat = { label: string; value: number; decimals?: number; suffix?: string; sub: string };

function StatsVideo({ memberId, name, look }: { memberId: number; name: string; look: AvatarLook }) {
  const { sky } = useSky();
  const board = useLoad(`archer-${memberId}`, () => archerBoard({ data: { id: memberId } }));
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const art = useRef<{ bg: HTMLImageElement | null; fig: HTMLImageElement | null } | null>(null);
  const [ready, setReady] = useState(false);
  const [state, setState] = useState<"pronto" | "registro" | "fatto">("pronto");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const result = useRef<{ blob: Blob; name: string } | null>(null);
  const first = name.split(" ")[0];

  const stats: Stat[] = useMemo(() => {
    const st = board.data?.stats;
    if (!st) return [];
    const out: Stat[] = [];
    const r = st.fitast;
    if (r?.place) out.push({ label: "Campionato FITAST", value: r.place, suffix: "°", sub: `${r.category || "in categoria"} · su ${r.size}` });
    out.push({ label: "Punti campionato", value: r?.points ?? st.champSeason, sub: st.seasonName || "Stagione in corso" });
    const since = st.since && st.seasons.length > 1 ? ` dal ${st.since}` : "";
    out.push({ label: "Gare", value: st.gare, sub: st.podiums ? `${st.podiums} ${st.podiums === 1 ? "podio" : "podi"}${since}` : st.gareSeason ? `${st.gareSeason} in questa stagione` : `in gara${since || " con la compagnia"}` });
    out.push({ label: "Frecce tirate", value: st.arrows, sub: `${st.trainings} ${st.trainings === 1 ? "allenamento" : "allenamenti"}` });
    if (st.avg != null) out.push({ label: "Media per freccia", value: st.avg, decimals: 2, sub: st.bestScore ? `miglior gara ${num(st.bestScore)} punti` : "allenamenti e gare" });
    const lv = levelOf(st.xp);
    out.push({ label: "Livello", value: lv.level, sub: `${num(lv.need - lv.into)} punti al ${lv.level + 1}` });
    return out.slice(0, 6);
  }, [board.data]);
  const level = useMemo(() => levelOf(board.data?.stats.xp ?? 0), [board.data]);
  const season = board.data?.stats.seasonName ?? "";

  // i disegni (scena e arciere) diventano immagini una volta sola
  useEffect(() => {
    let off = false;
    setReady(false);
    void (async () => {
      await painted();
      const host = stage.current;
      if (!host) return;
      const bgSvg = host.querySelector<SVGSVGElement>("[data-part=bg] svg");
      const figSvg = host.querySelector<SVGSVGElement>("[data-part=me] > svg");
      try {
        const figH = 1180 / demonScale(look);
        const [bg, fig] = await Promise.all([bgSvg ? svgImage(bgSvg, W, H) : null, figSvg ? svgImage(figSvg, (figH * FIG_W) / FIG_H, figH) : null]);
        const doc = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
        if (doc) await doc.ready;
        if (off) return;
        art.current = { bg, fig };
        setReady(true);
      } catch (e) {
        if (!off) setErr(e instanceof Error ? e.message : "Video non pronto.");
      }
    })();
    return () => {
      off = true;
    };
  }, [look]);

  const DURATION = 11;
  const night = look.scene === "montelago" || sky.tod === "notte";

  /** un fotogramma del video al tempo t (secondi) */
  const draw = (ctx: CanvasRenderingContext2D, t: number) => {
    const a = art.current;
    const f = fonts();
    ctx.save();
    ctx.fillStyle = "#07060a";
    ctx.fillRect(0, 0, W, H);
    // scena: entra dal nero e si avvicina piano per tutto il video
    if (a?.bg) {
      const z = 1.1 - 0.1 * ease(t / DURATION);
      ctx.globalAlpha = ease(t / 1.2);
      ctx.drawImage(a.bg, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z);
      ctx.globalAlpha = 1;
    }
    // scintille o pulviscolo che salgono
    for (let i = 0; i < 40; i++) {
      const seed = (i * 97.13) % 1;
      const x = ((i * 263) % W) + Math.sin(t * 0.9 + i) * 18;
      const y = H - (((t * (60 + (i % 7) * 18) + i * 137) % (H * 0.7)) + 260);
      ctx.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(t * 2 + i));
      ctx.fillStyle = night ? (i % 2 ? "#ffb04a" : "#ff6a1a") : "#fff6d8";
      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3) + seed, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // l'arciere sale dal basso e respira
    const feet = 1760;
    if (a?.fig) {
      const fh = 1180 / demonScale(look);
      const fw = (fh * FIG_W) / FIG_H;
      const rise = (1 - ease((t - 0.3) / 1.3)) * 500;
      const breath = 1 + Math.sin(t * 2.2) * 0.006;
      const cxFig = W * 0.3;
      groundShadow(ctx, cxFig, feet - 12 + rise, 220);
      ctx.save();
      ctx.translate(cxFig, feet + rise);
      ctx.scale(1, breath);
      ctx.drawImage(a.fig, -fw / 2, -fh, fw, fh);
      ctx.restore();
    }
    frame(ctx, f);
    // nome e stagione
    const head = ease((t - 0.8) / 0.9);
    ctx.globalAlpha = head;
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 18;
    fitText(ctx, name, 70 - (1 - head) * 40, 180, W - 140, 112, f.disp, "700");
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f1cf8a";
    ctx.font = `600 38px ${f.app}`;
    ctx.fillText(season ? `I miei numeri · ${season}` : "I miei numeri", 72, 240);
    ctx.globalAlpha = 1;
    // le schede dei numeri: una ogni secondo, scivolano da destra e il numero sale
    const x0 = W * 0.54;
    const cw = W - x0 - 56;
    stats.forEach((s, i) => {
      const t0 = 2 + i * 1.05;
      const k = ease((t - t0) / 0.6);
      if (k <= 0) return;
      const y = 440 + i * 196;
      const dx = (1 - k) * 260;
      ctx.globalAlpha = k;
      ctx.fillStyle = "rgba(10,8,14,0.66)";
      roundRect(ctx, x0 + dx, y, cw, 172, 30);
      ctx.fill();
      ctx.strokeStyle = i === 0 ? "rgba(241,207,138,0.7)" : "rgba(255,255,255,0.16)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      ctx.font = `600 30px ${f.app}`;
      ctx.fillText(s.label, x0 + dx + 30, y + 46);
      const c = clamp01((t - t0) / 1.1);
      const v = s.value * ease(c);
      ctx.fillStyle = i === 0 ? "#f1cf8a" : "#fff";
      fitText(ctx, `${num(v, s.decimals ?? 0)}${s.suffix ?? ""}`, x0 + dx + 28, y + 120, cw - 56, 78, f.disp, "700");
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      fitText(ctx, s.sub, x0 + dx + 30, y + 156, cw - 60, 26, f.app, "500");
      // il livello: la barra che si riempie verso il prossimo
      if (s.label === "Livello") {
        const p = (level.into / Math.max(1, level.need)) * ease(c);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        roundRect(ctx, x0 + dx + cw - 200, y + 98, 170, 16, 8);
        ctx.fill();
        ctx.fillStyle = "#7cf0a8";
        roundRect(ctx, x0 + dx + cw - 200, y + 98, Math.max(16, 170 * p), 16, 8);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    // chiusura
    const end = ease((t - (DURATION - 1.3)) / 0.8);
    if (end > 0) {
      ctx.globalAlpha = end * 0.82;
      ctx.fillStyle = "#07060a";
      ctx.fillRect(0, H * 0.42, W, 300);
      ctx.globalAlpha = end;
      ctx.textAlign = "center";
      ctx.fillStyle = "#f1cf8a";
      ctx.font = `700 92px ${f.disp}`;
      ctx.fillText("Arcieri Amiconi", W / 2, H * 0.42 + 150);
      ctx.fillStyle = "#fff";
      ctx.font = `500 36px ${f.app}`;
      ctx.fillText(`${first} tira con noi`, W / 2, H * 0.42 + 215);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  // anteprima ferma (a metà video) quando i disegni e i numeri sono pronti
  useEffect(() => {
    if (!ready || !stats.length || state === "registro") return;
    const ctx = canvas.current?.getContext("2d");
    if (ctx) draw(ctx, 8.6);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stats, state]);

  async function record() {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    setErr("");
    setMsg("");
    if (typeof MediaRecorder === "undefined" || typeof (c as HTMLCanvasElement & { captureStream?: unknown }).captureStream !== "function") {
      setErr("Questo telefono non sa registrare video dall'app: puoi condividere la foto.");
      return;
    }
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((x) => MediaRecorder.isTypeSupported(x)) ?? "";
    const stream = (c as HTMLCanvasElement & { captureStream: (fps: number) => MediaStream }).captureStream(30);
    const rec = new MediaRecorder(stream, { ...(type ? { mimeType: type } : {}), videoBitsPerSecond: 8_000_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: (rec.mimeType || type || "video/webm").split(";")[0] }));
    });
    setState("registro");
    draw(ctx, 0);
    rec.start(250);
    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const t = (performance.now() - t0) / 1000;
        draw(ctx, Math.min(t, DURATION));
        if (t >= DURATION + 0.3) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    rec.stop();
    stream.getTracks().forEach((tr) => tr.stop());
    const blob = await done;
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    result.current = { blob, name: `arcieri-${first.toLowerCase()}-numeri.${ext}` };
    setState("fatto");
    if (ext === "webm") setMsg("Il telefono registra in WebM: Instagram a volte non lo accetta, WhatsApp e Telegram sì.");
  }

  async function share() {
    if (!result.current) return;
    try {
      await shareFile(result.current.blob, result.current.name, `I miei numeri su Arcieri Amiconi`, setMsg);
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setMsg(e instanceof Error ? e.message : "Non condiviso");
    }
  }

  return (
    <div className="grid gap-3">
      <Card className="grid place-items-center !p-3">
        <canvas ref={canvas} width={W} height={H} className={cx("h-auto w-full max-w-[22rem] rounded-[1.4rem] shadow-card", ready ? "" : "opacity-40")} aria-label="Il video con i tuoi numeri" />
      </Card>
      {board.error ? <ErrorNote text={board.error} /> : null}
      {err ? <ErrorNote text={err} /> : null}
      {state === "fatto" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" onClick={() => void record()}>Rifai</Button>
          <Button onClick={() => void share()}><Glyph name="share" size={18} className="mr-2" /> Condividi</Button>
        </div>
      ) : (
        <Button onClick={() => void record()} disabled={!ready || !stats.length || state === "registro"}>
          <Glyph name="play" size={18} className="mr-2" /> {state === "registro" ? "Registro il video… (11 secondi)" : "Crea il video"}
        </Button>
      )}
      <p className="text-center text-xs text-muted">{state === "registro" ? "Resta su questa pagina finché non ha finito." : "Undici secondi, verticale: il tuo arciere nella sua scena e i tuoi numeri che salgono uno alla volta."}</p>
      {msg ? <p className="text-center text-sm text-muted">{msg}</p> : null}
      <div ref={stage} aria-hidden className="pointer-events-none fixed left-[-6000px] top-0 h-[960px] w-[540px] overflow-hidden">
        <div data-part="bg" className="relative h-[960px] w-[540px]">
          <SceneBackdrop sky={sky} id="storia-vbg" scene={look.scene} />
        </div>
        <div data-part="me"><ArcherFront look={{ ...look, lefty: false }} crop={`0 0 ${FIG_W} ${FIG_H}`} className="h-[370px] w-[200px]" /></div>
      </div>
    </div>
  );
}
