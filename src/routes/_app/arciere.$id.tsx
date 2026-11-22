import { useTeamAvatars } from "@/components/avatar-hero";
import { SceneBackdrop } from "@/components/scene-2d";
import { ArcherFront } from "@/components/archer-front";
import { useSky } from "@/lib/arcieri/sky3d";
import { createFileRoute } from "@tanstack/react-router";
import { archerBoard, listGadgets } from "@/lib/arcieri/club.api";
import { bowLabel, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { AvgLine, ScoreLine } from "@/components/charts";
import { Avatar, Card, ErrorNote, Loading } from "@/components/kit";
import { PrizeMark, prizeTier, topPrizes } from "@/components/prize-mark";
import { AVATAR_DEFAULT } from "@/lib/arcieri/avatar";

export const Route = createFileRoute("/_app/arciere/$id")({ component: Page });

function Page() {
  const looks = useTeamAvatars();
  const { sky } = useSky();
  const { id } = Route.useParams();
  const { data, error, loading } = useLoad(`archer-${id}`, () => archerBoard({ data: { id: Number(id) } }));
  const gadgets = useLoad(`archer-gadgets-${id}`, () => listGadgets());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  const name = memberLabel(data, [data]);
  const train = data.trainings.slice(-12).map((s) => ({ name: s.day.slice(5), avg: Number(s.avg.toFixed(2)) }));
  const comps = data.comps.map((c) => ({ name: c.day.slice(5), score: c.score }));
  const arrows = data.trainings.reduce((sum, s) => sum + s.arrows, 0);
  const points = data.trainings.reduce((sum, s) => sum + s.avg * s.arrows, 0);
  const shownPrizes = topPrizes((gadgets.data?.prizes ?? []).filter((prize) => prize.holders.some((holder) => holder.userId === data.userId)));
  // gli ultimi tre premi vinti, dal più recente
  const latest = (gadgets.data?.prizes ?? [])
    .flatMap((prize) => prize.holders.filter((h) => h.userId === data.userId).map((h) => ({ ...prize, at: h.unlockedAt })))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 3);
  const look = looks[data.userId] ?? AVATAR_DEFAULT;
  return (
    <div className="grid gap-5">
      {/* il suo arciere, grande e di fronte, con accanto gli ultimi premi */}
      <div className="aa-profile-stage relative h-[34rem] overflow-hidden rounded-[1.75rem]">
        <SceneBackdrop sky={sky} id={`pf${data.id}`} scene={look.scene} />
        <div className="absolute inset-x-0 bottom-[1%] top-[11%] flex justify-center pr-[22%]">
          <ArcherFront look={look} className="h-full w-auto drop-shadow-[0_16px_24px_rgba(0,0,0,0.5)]" />
        </div>
        <div className="absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/65 to-transparent p-3 pb-8">
          <Avatar size="lg" label={name} color={data.avatarColor} photo={data.photoUrl} look={looks[data.userId]} admin={data.admin} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl leading-none text-white">{name}</h1>
            <p className="mt-1 text-xs text-white/75">{data.bowType ? bowLabel(data.bowType) : "Arco non indicato"} · nel gruppo dal {data.joinedOn || "—"}</p>
          </div>
        </div>
        <div className="absolute bottom-4 right-2 top-24 flex w-[24%] flex-col items-center justify-center gap-3">
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
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="text-xs text-muted">Frecce</p><p className="font-display text-3xl tabular-nums">{arrows}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Media</p><p className="font-display text-3xl tabular-nums">{arrows ? fmtAvg(points / arrows) : "—"}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Gare</p><p className="font-display text-3xl tabular-nums">{data.comps.length}</p></Card>
      </div>
      <Card>
        <h2 className="mb-3 font-display text-2xl">I premi migliori</h2>
        {!gadgets.loading && shownPrizes.length === 0 ? <p className="text-sm text-muted">Nessuno sbloccato.</p> : (
          <div className="grid grid-cols-3 gap-2">
            {shownPrizes.map((prize) => (
              <div key={prize.code} className="grid justify-items-center gap-1 text-center">
                <PrizeMark code={prize.code} size="lg" />
                <p className="text-xs font-semibold leading-tight">{prize.title}</p>
                <p className="text-[10px] text-muted">{prizeTier(prize.code).label}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-2xl">Allenamento dopo allenamento</h2>
        <AvgLine data={train} />
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-2xl">Gara dopo gara</h2>
        <ScoreLine data={comps} />
      </Card>
      <p className="text-sm text-muted">Qui si vede solo il riassunto. Note, attrezzatura personale e acquisti restano di chi li ha scritti.</p>
    </div>
  );
}
