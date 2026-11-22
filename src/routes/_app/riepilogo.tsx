import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, Card, Empty, ErrorNote, Loading, PageHead } from "@/components/kit";
import { Glyph } from "@/components/icons";
import { useLoad } from "@/lib/arcieri/use-load";
import { useEntryState } from "@/lib/arcieri/back-restore";
import { SITE_URL, isNativeApp, saveFile } from "@/lib/arcieri/native";
import { monthSummary } from "@/lib/arcieri/riepilogo.api";

export const Route = createFileRoute("/_app/riepilogo")({ component: Page });

type Summary = Awaited<ReturnType<typeof monthSummary>>;

const W = 1080;
const H = 1920;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function shift(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
}

const num = (v: number, d = 0) => v.toLocaleString("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Disegna la storia verticale (1080×1920): la stessa immagine si vede qui e si condivide. */
function drawStory(ctx: CanvasRenderingContext2D, s: Summary) {
  const disp = cssVar("--font-disp", "'Barlow Condensed', 'Arial Narrow', Impact, sans-serif");
  const app = cssVar("--font-app", "Outfit, 'Segoe UI', sans-serif");
  // fondo: verde notte con un alone dietro il bersaglio
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#10201a");
  bg.addColorStop(1, "#060a08");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 760, 40, W / 2, 760, 620);
  glow.addColorStop(0, "rgba(61,143,95,0.55)");
  glow.addColorStop(1, "rgba(61,143,95,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#7cf0a8";
  ctx.font = `700 34px ${app}`;
  ctx.fillText("ARCIERI AMICONI · IL MIO MESE", 80, 150);
  ctx.fillStyle = "#f3f0e8";
  // il nome del mese riempie la riga ma non esce mai dal bordo (SETTEMBRE è il più lungo)
  const title = s.monthName.toUpperCase();
  let size = 190;
  ctx.font = `700 ${size}px ${disp}`;
  while (size > 90 && ctx.measureText(title).width > W - 152) {
    size -= 6;
    ctx.font = `700 ${size}px ${disp}`;
  }
  ctx.fillText(title, 72, 330);
  ctx.fillStyle = "rgba(243,240,232,0.7)";
  ctx.font = `500 40px ${app}`;
  ctx.fillText(s.name, 80, 395);

  // bersaglio con le frecce del mese
  const cx = W / 2;
  const cy = 760;
  const R = 300;
  const rings = ["#f4f1e8", "#f4f1e8", "#1b1b1b", "#1b1b1b", "#3d8fd6", "#3d8fd6", "#d84c3f", "#d84c3f", "#f2c94c", "#f2c94c"];
  rings.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, R * (1 - i / 10), 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = i < 2 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
  for (const d of s.dots) {
    const x = cx + Math.max(-1.1, Math.min(1.1, d.x)) * R;
    const y = cy + Math.max(-1.1, Math.min(1.1, d.y)) * R;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#0c1210";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // quattro numeri
  const boxes: { v: string; l: string; c: string }[] = [
    { v: num(s.arrows), l: "frecce tirate", c: "#f3f0e8" },
    { v: num(s.sessions), l: s.sessions === 1 ? "allenamento" : "allenamenti", c: "#f3f0e8" },
    { v: s.avg != null ? num(s.avg, 2) : "—", l: s.avgDelta != null ? `media in decimi · ${s.avgDelta >= 0 ? "+" : "−"}${num(Math.abs(s.avgDelta), 2)}` : "media in decimi", c: "#7cf0a8" },
    { v: s.best ? `${s.best.points}` : "—", l: s.best ? `miglior volée su ${s.best.max}` : "miglior volée", c: "#e0b23a" },
  ];
  boxes.forEach((b, i) => {
    const x = 80 + (i % 2) * 470;
    const y = 1130 + Math.floor(i / 2) * 250;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, 450, 220, 36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = b.c;
    ctx.font = `700 110px ${disp}`;
    ctx.fillText(b.v, x + 36, y + 130);
    ctx.fillStyle = "rgba(243,240,232,0.65)";
    ctx.font = `500 32px ${app}`;
    ctx.fillText(b.l, x + 38, y + 184);
  });

  // una frase sul mese
  const lines: string[] = [];
  if (s.spreadChange != null && s.spreadChange !== 0) lines.push(s.spreadChange > 0 ? `Gruppo più stretto del ${s.spreadChange}% rispetto al mese prima.` : `Gruppo più largo del ${Math.abs(s.spreadChange)}% rispetto al mese prima.`);
  if (s.rank && s.rank.of > 1) lines.push(`${s.rank.pos}° su ${s.rank.of} per frecce nella compagnia.`);
  if (s.days) lines.push(`In campo ${s.days} ${s.days === 1 ? "giorno" : "giorni"} diversi.`);
  ctx.fillStyle = "#f3f0e8";
  ctx.font = `500 40px ${app}`;
  lines.slice(0, 2).forEach((t, i) => ctx.fillText(t, 80, 1690 + i * 56));

  ctx.fillStyle = "rgba(243,240,232,0.55)";
  ctx.font = `500 30px ${app}`;
  ctx.fillText(s.company || "Arcieri Amiconi", 80, 1850);
  ctx.textAlign = "right";
  ctx.fillStyle = "#7cf0a8";
  ctx.fillText(SITE_URL.replace(/^https:\/\//, ""), W - 80, 1850);
  ctx.textAlign = "left";
}

/** Il mio mese: i numeri del mese in un'immagine verticale da condividere. */
function Page() {
  const [month, setMonth] = useEntryState("riepilogo-mese", monthKey(new Date()));
  const { data, error, loading } = useLoad(`month-${month}`, () => monthSummary({ data: { month } }));
  const canvas = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!data || !canvas.current) return;
    const ctx = canvas.current.getContext("2d");
    if (!ctx) return;
    let off = false;
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts;
    void (fonts ? fonts.ready : Promise.resolve()).then(() => {
      if (!off) drawStory(ctx, data);
    });
    return () => {
      off = true;
    };
  }, [data]);
  const thisMonth = monthKey(new Date());
  async function share() {
    if (!canvas.current || !data) return;
    setBusy(true);
    setMsg("");
    try {
      const blob = await new Promise<Blob | null>((r) => canvas.current?.toBlob(r, "image/png"));
      if (!blob) throw new Error("Immagine non creata.");
      const name = `arcieri-amiconi-${data.month}.png`;
      const file = new File([blob], name, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
      if (!isNativeApp() && nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], text: `Il mio ${data.monthName} su Arcieri Amiconi` });
      } else {
        await saveFile(blob, name);
        if (!isNativeApp()) setMsg("Immagine scaricata: la trovi nei download, pronta da pubblicare.");
      }
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError")) setMsg(e instanceof Error ? e.message : "Non condivisa");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3">
      <PageHead kicker="Analizza" title="Il mio mese" lede="I numeri del mese in un'immagine verticale, pronta per Instagram e WhatsApp." />
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setMonth(shift(month, -1))} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06]" aria-label="Mese prima">
          <Glyph name="chevron" size={18} className="rotate-180" />
        </button>
        <p className="font-display text-2xl capitalize">{data?.label ?? month}</p>
        <button type="button" disabled={month >= thisMonth} onClick={() => setMonth(shift(month, 1))} className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.06] disabled:opacity-30" aria-label="Mese dopo">
          <Glyph name="chevron" size={18} />
        </button>
      </div>
      {loading ? <Loading /> : error || !data ? <ErrorNote text={error || "Errore"} /> : data.arrows === 0 ? (
        <Empty title={`Nessun tiro a ${data.monthName}`} text="Registra un allenamento: a fine mese qui trovi la tua storia da condividere." />
      ) : (
        <>
          <Card className="grid place-items-center !p-3">
            <canvas ref={canvas} width={W} height={H} className="h-auto w-full max-w-[22rem] rounded-[1.4rem] shadow-card" aria-label={`Riepilogo di ${data.label}`} />
          </Card>
          <Button onClick={() => void share()} disabled={busy}>
            <Glyph name="share" size={18} className="mr-2" /> {busy ? "Preparo l'immagine…" : "Condividi l'immagine"}
          </Button>
          {msg ? <p className="text-center text-sm text-muted">{msg}</p> : null}
        </>
      )}
    </div>
  );
}
