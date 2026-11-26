import { useEffect, useRef, useState } from "react";
import { marketShareLink, type MarketItem } from "@/lib/arcieri/market.api";
import { categoryLabel, euro } from "@/lib/arcieri/labels";
import { openExternal, saveFile, shareRich, SITE_URL } from "@/lib/arcieri/native";
import { Button } from "@/components/kit";
import { Glyph } from "@/components/icons";

/**
 * Condividere l'anteprima di un annuncio del Mercatino fuori dall'app:
 * una scheda-immagine (foto, titolo, prezzo, stato, luogo) e un link pubblico che su WhatsApp,
 * Facebook ed e-mail si apre con la foto. Si manda a una persona, a un gruppo, in un post o in una storia.
 */

const CONDITION: Record<string, string> = { nuovo: "Nuovo", "come-nuovo": "Come nuovo", buono: "Buono", usato: "Usato" };
const STATUS: Record<string, { label: string; tone: string }> = {
  open: { label: "Disponibile", tone: "#2fbf71" },
  reserved: { label: "Riservato", tone: "#e3a21a" },
  sold: { label: "Venduto", tone: "#8a949c" },
};

/** il sito dove si apre il link: quello in cui gira l'app, o l'indirizzo pubblico se siamo in prova sul computer */
function siteBase() {
  if (typeof window === "undefined") return SITE_URL;
  const o = window.location.origin;
  return /^https:\/\//.test(o) && !/localhost|127\.0\.0\.1/.test(o) ? o : SITE_URL;
}

function adTexts(item: MarketItem, link: string) {
  const price = item.priceCents != null ? euro(item.priceCents) : "prezzo da chiedere";
  const cond = CONDITION[item.condition] ?? item.condition;
  const st = STATUS[item.status] ?? STATUS.open;
  const details = [cond, categoryLabel(item.category), item.qty > 1 ? `${item.qty} pezzi` : "", item.status !== "open" ? st.label : ""].filter(Boolean).join(" · ");
  const desc = item.description.replace(/\s+/g, " ").trim();
  const short = desc.length > 180 ? `${desc.slice(0, 177).trimEnd()}…` : desc;
  const lines = (bold: boolean) =>
    [
      `${bold ? `*${item.title}*` : item.title} — ${price}`,
      details,
      item.place ? `Dove: ${item.place}` : "",
      short ? `\n${short}` : "",
      "",
      "Lo trovi nel Mercatino dell'app Arcieri Amiconi:",
      link,
    ]
      .filter((l, i) => l !== "" || i === 4)
      .join("\n");
  return { wa: lines(true), plain: lines(false), subject: `${item.title} — ${price} · Mercatino Arcieri Amiconi` };
}

/* ---------- la scheda-immagine, disegnata sul telefono ---------- */

const W = 1080;
const H = 1350;

function loadImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function target(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const rings = ["#f3f0e8", "#1d1d1d", "#3a7fd0", "#d4402f", "#f2c230"];
  rings.forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1 - i * 0.19), 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
}

/** spezza il testo in righe che stanno nella larghezza; l'ultima finisce con … se serve */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= width || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  let last = out[max - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1).trimEnd();
  out[max - 1] = `${last}…`;
  return out;
}

async function drawCard(item: MarketItem, photo: string | null): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  try {
    await Promise.all([document.fonts.load('700 80px "Barlow Condensed"'), document.fonts.load('600 34px "Outfit"'), document.fonts.load('400 34px "Outfit"')]);
  } catch {
    /* si disegna con il carattere di sistema */
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const display = '"Barlow Condensed", "Arial Narrow", sans-serif';
  const body = 'Outfit, system-ui, sans-serif';

  ctx.fillStyle = "#0c1210";
  ctx.fillRect(0, 0, W, H);

  // la foto in alto, a tutta larghezza
  const PH = 820;
  const img = photo ? await loadImage(photo) : null;
  if (img && img.naturalWidth) {
    const s = Math.max(W / img.naturalWidth, PH / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, PH);
    ctx.clip();
    ctx.drawImage(img, (W - w) / 2, (PH - h) / 2, w, h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#16201a";
    ctx.fillRect(0, 0, W, PH);
    ctx.globalAlpha = 0.18;
    target(ctx, W / 2, PH / 2, 260);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#8fa093";
    ctx.font = `600 40px ${body}`;
    ctx.textAlign = "center";
    ctx.fillText(categoryLabel(item.category), W / 2, PH / 2 + 330);
    ctx.textAlign = "left";
  }
  const fade = ctx.createLinearGradient(0, PH - 220, 0, PH);
  fade.addColorStop(0, "rgba(12,18,16,0)");
  fade.addColorStop(1, "rgba(12,18,16,1)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, PH - 220, W, 220);

  // marchio in alto a sinistra
  ctx.font = `600 32px ${body}`;
  const brand = "Mercatino · Arcieri Amiconi";
  const bw = ctx.measureText(brand).width + 112;
  ctx.fillStyle = "rgba(12,18,16,0.78)";
  rounded(ctx, 40, 40, bw, 76, 38);
  ctx.fill();
  target(ctx, 82, 78, 22);
  ctx.fillStyle = "#f3f0e8";
  ctx.fillText(brand, 118, 89);

  // stato, se non è più disponibile
  if (item.status !== "open") {
    const st = STATUS[item.status] ?? STATUS.open;
    ctx.font = `700 34px ${body}`;
    const sw = ctx.measureText(st.label).width + 56;
    ctx.fillStyle = st.tone;
    rounded(ctx, W - 40 - sw, 40, sw, 76, 38);
    ctx.fill();
    ctx.fillStyle = "#0b120e";
    ctx.fillText(st.label, W - 40 - sw + 28, 89);
  }

  // titolo, prezzo, dettagli, luogo
  const X = 64;
  const TW = W - X * 2;
  let y = PH + 30;
  ctx.fillStyle = "#f3f0e8";
  ctx.font = `700 78px ${display}`;
  const title = wrap(ctx, item.title, TW, 2);
  for (const line of title) {
    y += 76;
    ctx.fillText(line, X, y);
  }
  y += 118;
  ctx.font = `700 118px ${display}`;
  ctx.fillStyle = "#f3f0e8";
  ctx.fillText(item.priceCents != null ? euro(item.priceCents) : "Prezzo da chiedere", X, y);
  const details = [CONDITION[item.condition] ?? item.condition, categoryLabel(item.category), item.qty > 1 ? `${item.qty} pezzi` : ""].filter(Boolean).join(" · ");
  ctx.font = `400 36px ${body}`;
  ctx.fillStyle = "#a9b5ab";
  y += 64;
  ctx.fillText(wrap(ctx, details, TW, 1)[0] ?? "", X, y);
  if (item.place && y + 56 < H - 110) {
    y += 56;
    // segnaposto
    ctx.save();
    ctx.translate(X, y - 30);
    ctx.strokeStyle = "#a9b5ab";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(14, 34);
    ctx.bezierCurveTo(4, 24, 0, 18, 0, 13);
    ctx.arc(14, 13, 14, Math.PI, 0);
    ctx.bezierCurveTo(28, 18, 24, 24, 14, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(14, 13, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#c9d2c9";
    ctx.fillText(wrap(ctx, item.place, TW - 48, 1)[0] ?? "", X + 46, y);
  }

  // piede: dove trovarlo
  ctx.fillStyle = "#3d8f5f";
  ctx.fillRect(0, H - 96, W, 4);
  ctx.fillStyle = "#16201a";
  ctx.fillRect(0, H - 92, W, 92);
  ctx.font = `500 32px ${body}`;
  ctx.fillStyle = "#c9d2c9";
  ctx.fillText("Lo trovi nel Mercatino dell'app Arcieri Amiconi", X, H - 34);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88));
}

/* ---------- icone semplici dei canali (non i marchi) ---------- */

function ChannelIcon({ kind }: { kind: "chat" | "people" | "camera" | "mail" }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (kind === "chat") return <svg {...common}><path d="M4 19.5 5.3 15.6A8 8 0 1 1 8.6 18.7Z" /><path d="M9 10.5h6M9 13.5h4" /></svg>;
  if (kind === "people") return <svg {...common}><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.4" /><path d="M15.5 14.2A4.6 4.6 0 0 1 21 18.5" /></svg>;
  if (kind === "camera") return <svg {...common}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></svg>;
  return <svg {...common}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>;
}

/* ---------- il pannello ---------- */

export function ShareAd({ item, photos }: { item: MarketItem; photos: { src: string }[] }) {
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [card, setCard] = useState<{ blob: Blob; url: string } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const urlRef = useRef("");

  const fallback = `${siteBase()}/squadra#mercatino-${item.id}`;
  const shown = link || fallback;
  const texts = adTexts(item, shown);
  const fileName = `annuncio-${item.id}.jpg`;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    if (!link) {
      marketShareLink({ data: { id: item.id } })
        .then((r) => alive && setLink(`${siteBase()}/api/annuncio/${r.token}`))
        .catch(() => alive && setLink(fallback));
    }
    void drawCard(item, photos[0]?.src ?? null).then((blob) => {
      if (!alive || !blob) return;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setCard({ blob, url: urlRef.current });
    });
    return () => {
      alive = false;
    };
    // la scheda si ridisegna se cambiano titolo, prezzo, stato o la prima foto
  }, [open, item.title, item.priceCents, item.status, item.place, item.condition, photos[0]?.src]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function withPhoto() {
    setNote("");
    setBusy("foto");
    const r = await shareRich({ title: item.title, text: texts.wa, file: card?.blob, name: fileName });
    setBusy("");
    if (r === "none") {
      if (card) await saveFile(card.blob, fileName);
      const ok = await copy(texts.plain);
      setNote(`${card ? "Immagine salvata" : "Immagine non pronta"}${ok ? " e testo copiato" : ""}: allegala dove vuoi condividerla.`);
    }
  }

  async function instagram() {
    setNote("");
    if (!card) return setNote("L'immagine si sta preparando, riprova tra un attimo.");
    const ok = await copy(texts.plain);
    setBusy("ig");
    const r = await shareRich({ title: item.title, file: card.blob, name: fileName });
    setBusy("");
    if (r === "none") {
      await saveFile(card.blob, fileName);
      setNote(`Immagine salvata: aprila in Instagram per una storia o un post.${ok ? " Il testo è copiato: incollalo nella didascalia." : ""}`);
    } else if (ok) setNote("Scegli Instagram (storia, post o messaggio). Il testo è copiato: incollalo nella didascalia.");
  }

  const waHref = `https://wa.me/?text=${encodeURIComponent(texts.wa)}`;
  const fbHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shown)}`;
  const mailHref = `mailto:?subject=${encodeURIComponent(texts.subject)}&body=${encodeURIComponent(texts.plain)}`;
  const tile = "aa-press flex min-h-14 items-center gap-2.5 rounded-xl bg-white/[0.06] px-3 text-left text-sm";

  if (!open) {
    return (
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Glyph name="share" size={16} /> Condividi l'annuncio
      </Button>
    );
  }
  return (
    <div className="grid gap-2.5 rounded-2xl bg-white/[0.04] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">Condividi l'anteprima</p>
        <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi la condivisione" className="aa-press grid h-8 w-8 place-items-center rounded-full text-muted">
          <Glyph name="close" size={15} />
        </button>
      </div>
      <div className="grid place-items-center overflow-hidden rounded-xl bg-black/30">
        {card ? <img src={card.url} alt={`Anteprima dell'annuncio ${item.title}`} className="max-h-80 w-auto rounded-xl" /> : <div className="grid h-64 w-full place-items-center text-xs text-muted">Preparo l'anteprima…</div>}
      </div>
      <Button onClick={() => void withPhoto()} disabled={busy === "foto"}>
        <Glyph name="share" size={16} /> {busy === "foto" ? "Apro…" : "Condividi con la foto"}
      </Button>
      <p className="-mt-1 text-[0.7rem] leading-snug text-muted">Dal telefono scegli WhatsApp (una persona o un gruppo), Instagram, Facebook, Telegram o la posta.</p>
      <div className="grid grid-cols-2 gap-1.5">
        <a href={waHref} target="_blank" rel="noreferrer" className={tile}>
          <ChannelIcon kind="chat" />
          <span className="min-w-0"><b className="block">WhatsApp</b><span className="block text-[0.68rem] text-muted">persona o gruppo</span></span>
        </a>
        <button type="button" onClick={() => void openExternal(fbHref)} className={tile}>
          <ChannelIcon kind="people" />
          <span className="min-w-0"><b className="block">Facebook</b><span className="block text-[0.68rem] text-muted">post, gruppo, Messenger</span></span>
        </button>
        <button type="button" onClick={() => void instagram()} disabled={busy === "ig"} className={tile}>
          <ChannelIcon kind="camera" />
          <span className="min-w-0"><b className="block">Instagram</b><span className="block text-[0.68rem] text-muted">storia o post con la foto</span></span>
        </button>
        <a href={mailHref} className={tile}>
          <ChannelIcon kind="mail" />
          <span className="min-w-0"><b className="block">E-mail</b><span className="block text-[0.68rem] text-muted">testo e link</span></span>
        </a>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <Button variant="ghost" onClick={() => void copy(`${texts.plain}`).then((ok) => setNote(ok ? "Testo e link copiati." : "Non riesco a copiare: tieni premuto sul link qui sotto."))}>
          <Glyph name="link" size={15} /> Copia testo
        </Button>
        <Button variant="ghost" onClick={() => card && void saveFile(card.blob, fileName)} disabled={!card}>
          <Glyph name="download" size={15} /> Salva immagine
        </Button>
      </div>
      <p className="break-all text-[0.68rem] text-muted">{shown}</p>
      {note ? <p className="rounded-xl bg-white/[0.06] px-3 py-2 text-xs">{note}</p> : null}
    </div>
  );
}
