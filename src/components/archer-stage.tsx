import type { ReactNode } from "react";
import { SceneBackdrop } from "@/components/scene-2d";
import { ArcherFront } from "@/components/archer-front";
import { useSky } from "@/lib/arcieri/sky3d";
import { archerBoard, listGadgets } from "@/lib/arcieri/club.api";
import { bowLabel, memberLabel } from "@/lib/arcieri/labels";
import { useLoad } from "@/lib/arcieri/use-load";
import { Avatar } from "@/components/kit";
import { PrizeMark, prizeTier } from "@/components/prize-mark";
import { PiazzoleMark } from "@/components/piazzole-mark";
import { LevelCrest } from "@/components/level-crest";
import { RankBanner } from "@/components/rank-banner";
import { Glyph } from "@/components/icons";
import { AVATAR_DEFAULT, type AvatarLook } from "@/lib/arcieri/avatar";

export type Board = Awaited<ReturnType<typeof archerBoard>>;

export const ROLE_STYLE: Record<string, { label: string; color: string }> = {
  super: { label: "Fondatore", color: "#ffd27a" },
  leader: { label: "Presidente", color: "#7cf0a8" },
  coach: { label: "Allenatore", color: "#8cc3f0" },
};

/** gli incarichi della persona, come etichette colorate */
function roleBadges(r: Board["roles"]) {
  return [...(r.level ? [r.level] : []), ...(r.leader ? ["leader"] : []), ...(r.coach ? ["coach"] : [])].map((k) => ROLE_STYLE[k]);
}

/** «marzo 2025» da una data AAAA-MM-GG */
export function sinceLabel(day: string) {
  const [y, m] = day.split("-").map(Number);
  if (!y || !m) return day;
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** nome e soprannome come li vedono tutti */
export function archerName(data: Board) {
  const full = [data.givenName, data.familyName].filter(Boolean).join(" ").trim();
  const name = full || memberLabel(data, [data]);
  const nick = data.nickname.trim() && data.nickname.trim() !== full ? data.nickname.trim() : "";
  return { name, nick };
}

/**
 * La scheda dell'arciere come la vedono tutti: l'arciere grande nella sua scena, lo stendardo col posto
 * nel campionato, il livello, gli ultimi premi. Uguale sulla pagina dell'arciere e sul proprio profilo
 * (dove in più si cambiano foto e aspetto).
 */
export function ArcherStage({ data, look: lookIn, avatar, onArcherTap, corner }: {
  data: Board;
  look?: AvatarLook | null;
  /** al posto del tondo con la foto (sul proprio profilo: si tocca per cambiarla) */
  avatar?: ReactNode;
  /** tocco sull'arciere (sul proprio profilo apre l'aspetto) */
  onArcherTap?: () => void;
  /** in alto a destra, sopra la scena */
  corner?: ReactNode;
}) {
  const { sky } = useSky();
  const gadgets = useLoad(`archer-gadgets-${data.id}`, () => listGadgets());
  const { name, nick } = archerName(data);
  const badges = roleBadges(data.roles);
  // gli ultimi tre premi vinti, dal più recente
  const latest = (gadgets.data?.prizes ?? [])
    .flatMap((prize) => prize.holders.filter((h) => h.userId === data.userId).map((h) => ({ ...prize, at: h.unlockedAt })))
    // dal più recente; sbloccati insieme (per esempio dopo un'importazione dal portale) prima il più prezioso
    .sort((a, b) => b.at.slice(0, 16).localeCompare(a.at.slice(0, 16)) || prizeTier(b.code).rank - prizeTier(a.code).rank)
    .slice(0, 3);
  const look = lookIn ?? AVATAR_DEFAULT;
  const rank = data.stats.fitast;
  const figure = <ArcherFront look={look} fit className="h-full w-auto" />;
  return (
    // la scena va da bordo a bordo, parte subito sotto l'intestazione e in basso sfuma nella pagina (come in Casa)
    <div className="aa-profile-stage relative -mx-4 -mt-6 h-[38rem] overflow-hidden">
      <div className="aa-stage-bleed pointer-events-none absolute inset-0" aria-hidden>
        <SceneBackdrop sky={sky} id={`pf${data.id}`} scene={look.scene} />
        <div className="absolute inset-x-0 bottom-0 h-[22%] bg-gradient-to-t from-black/35 to-transparent" />
      </div>
      {/* luce morbida dietro l'arciere e ombra a terra: l'arciere sta nella scena, non sopra */}
      <div className={`aa-stage-shadow pointer-events-none absolute bottom-[3.5%] h-[4.5%] w-[34%] -translate-x-1/2 ${rank ? "left-1/2" : "left-[39%]"}`} aria-hidden />
      <div className={`absolute inset-x-0 bottom-[1%] top-[11%] flex justify-center ${rank ? "px-[22%]" : "pr-[22%]"}`}>
        {onArcherTap ? (
          <button type="button" onClick={onArcherTap} aria-label="Cambia l'aspetto del tuo arciere" className="h-full">
            {figure}
          </button>
        ) : (
          figure
        )}
      </div>
      {/* il posto vero nel campionato FITAST, come uno stendardo appeso a sinistra */}
      {rank ? <RankBanner r={rank} color={look.faceBg || look.shirt} className="absolute left-[6%] top-[8rem] w-[23%]" /> : null}
      {/* il livello dell'arciere, come uno stemma in basso a sinistra */}
      <div className="aa-prize-float absolute bottom-[5%] left-4 w-[23%]" style={{ animationDelay: "0.1s" }}>
        <LevelCrest xp={data.xp} />
      </div>
      <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/65 to-transparent px-4 pb-8 pt-4">
        <span className="relative shrink-0">
          {avatar ?? <Avatar size="lg" label={name} color={data.avatarColor} photo={data.photoUrl} look={lookIn ?? undefined} admin={data.admin} xp={data.xp} />}
        </span>
        <div className="min-w-0 flex-1">
          {/* nome e incarichi sulla stessa riga */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="min-w-0 truncate font-display text-3xl leading-none text-white">{name}</h1>
            {badges.map((b) => <span key={b.label} className="shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-bold text-[#1a1408] shadow" style={{ background: b.color }}>{b.label}</span>)}
          </div>
          {nick ? <p className="text-xs italic text-white/75">«{nick}»</p> : null}
          {/* arco, compagnia e da quando tira con noi */}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.72rem] text-white/85">
            <span className="inline-flex items-center gap-1"><Glyph name="bow" size={13} className="shrink-0 text-[#f2c14e]" />{data.bowType ? bowLabel(data.bowType) : "Arco da scegliere"}</span>
            {data.roles.companyName ? <span className="inline-flex min-w-0 items-center gap-1"><Glyph name="team" size={13} className="shrink-0 text-[#f2c14e]" /><span className="truncate">{data.roles.companyName}</span></span> : null}
            {data.joinedOn ? <span className="inline-flex items-center gap-1"><Glyph name="calendar" size={13} className="shrink-0 text-[#f2c14e]" />Con noi da {sinceLabel(data.joinedOn)}</span> : null}
          </div>
        </div>
        {corner}
      </div>
      {/* le piazzole fatte, come un picchetto in basso a destra (di fronte allo stemma del livello) */}
      <div className="aa-prize-float absolute bottom-[5%] right-4 w-[23%] grid justify-items-center" style={{ animationDelay: "0.25s" }}>
        <PiazzoleMark n={data.stats.piazzole} id={`pz${data.id}`} />
      </div>
      <div className="absolute bottom-[27%] right-4 top-28 flex w-[23%] flex-col items-center justify-center gap-2">
        {latest.length ? (
          latest.map((prize, i) => (
            <div key={prize.code} className="aa-prize-float grid justify-items-center text-center" style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <PrizeMark code={prize.code} size={i === 0 ? "lg" : "md"} />
              <p className="mt-0.5 line-clamp-2 text-[0.65rem] font-semibold leading-tight text-white drop-shadow">{prize.title}</p>
            </div>
          ))
        ) : gadgets.loading ? null : (
          <p className="rounded-2xl bg-black/40 p-2 text-center text-[0.7rem] text-white/80">Ancora nessun premio</p>
        )}
      </div>
    </div>
  );
}
