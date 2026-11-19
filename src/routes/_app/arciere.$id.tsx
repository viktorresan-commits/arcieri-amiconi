import { createFileRoute } from "@tanstack/react-router";
import { archerBoard, listGadgets } from "@/lib/arcieri/club.api";
import { bowLabel, memberLabel } from "@/lib/arcieri/labels";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { AvgLine, ScoreLine } from "@/components/charts";
import { Avatar, Card, ErrorNote, Loading, PageHead } from "@/components/kit";
import { PrizeMark, prizeTier, topPrizes } from "@/components/prize-mark";

export const Route = createFileRoute("/_app/arciere/$id")({ component: Page });

function Page() {
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
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-4">
        <Avatar size="xl" label={name} color={data.avatarColor} photo={data.photoUrl} />
        <div>
          <PageHead title={name} lede={data.bowType ? bowLabel(data.bowType) : "Arco non indicato"} />
          <p className="text-xs text-muted">Nel gruppo dal {data.joinedOn || "—"}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="text-xs text-muted">Frecce</p><p className="font-display text-3xl tabular-nums">{arrows}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Media</p><p className="font-display text-3xl tabular-nums">{arrows ? fmtAvg(points / arrows) : "—"}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted">Gare</p><p className="font-display text-3xl tabular-nums">{data.comps.length}</p></Card>
      </div>
      <Card>
        <h2 className="mb-3 font-display text-2xl">Premi</h2>
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
