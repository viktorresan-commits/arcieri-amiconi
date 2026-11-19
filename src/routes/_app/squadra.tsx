import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { listClubOrders, listGadgets, saveClubOrder, setClubOrder, skillBoard, squadBoard } from "@/lib/arcieri/club.api";
import { memberLabel, DIVISIONS } from "@/lib/arcieri/labels";
import { fmtAvg } from "@/lib/arcieri/scoring";
import { useLoad } from "@/lib/arcieri/use-load";
import { ANIMALS, animalByLabel } from "@/lib/arcieri/sagome";
import { DistBars, MultiBars, useThemeInk } from "@/components/charts";
import { BoarTarget } from "@/components/boar-target";
import { Avatar, Button, Card, Empty, ErrorNote, Field, Loading, PageHead, Select, TextInput } from "@/components/kit";
import { useMember } from "@/components/shell";
import { PrizeMark, prizeTier } from "@/components/prize-mark";

export const Route = createFileRoute("/_app/squadra")({ component: Page });

type Archer = Awaited<ReturnType<typeof squadBoard>>["people"][number] & { name: string; color: string; mark: string; skill: number };

const INK = ["#e07a2f", "#3d8f5f", "#9eb6c9", "#d15c56", "#e6b325", "#2a6294", "#c9a27a", "#8f6bb5"];
const RINGS = [
  { r: 1, fill: "#f4f1ea" },
  { r: 0.8, fill: "#1a1c1e" },
  { r: 0.6, fill: "#2a6294" },
  { r: 0.4, fill: "#c4473d" },
  { r: 0.2, fill: "#e6b325" },
];

function skillOf(row: { champ: number; compAvg: number | null; avg: number | null }) {
  if (row.champ > 0) return { skill: 3_000_000 + row.champ, mark: `${row.champ} pt campionato` };
  if (row.compAvg != null) return { skill: 1_000_000 + row.compAvg, mark: `media gara ${fmtAvg(row.compAvg)}` };
  if (row.avg != null) return { skill: row.avg, mark: `media tiro ${fmtAvg(row.avg)}` };
  return { skill: -1, mark: "" };
}

function bySkill(a: Archer, b: Archer) {
  return b.skill - a.skill || b.arrows - a.arrows || a.name.localeCompare(b.name, "it");
}

function axisName(name: string, peers: string[]) {
  const first = name.split(" ")[0] || name;
  const shared = peers.filter((peer) => (peer.split(" ")[0] || peer) === first).length > 1;
  const second = name.split(" ")[1]?.[0];
  const base = shared && second ? `${first} ${second}.` : first;
  return base.length > 9 ? `${base.slice(0, 8)}…` : base;
}

function Page() {
  const ink = useThemeInk();
  const palette = [ink.primary, ink.accent, ink.soft];
  const { me } = useMember();
  const { data, error, loading } = useLoad("squad-board", () => squadBoard());
  const [board, setBoard] = useState<"padiglione" | "sagoma">("padiglione");
  const [face, setFace] = useState("io");
  const [picked, setPicked] = useState<string[]>([]);
  const [pick, setPick] = useState<string[]>([]);
  const people = useMemo(() => {
    const rows = data?.people ?? [];
    const names = rows.map((row) => memberLabel(row, rows));
    return rows.map((row, index) => {
      const scored = skillOf(row);
      return { ...row, ...scored, name: names[index] ?? row.givenName, color: INK[index % INK.length] ?? INK[0] };
    });
  }, [data]);
  const ranked = useMemo(() => [...people].sort(bySkill), [people]);
  const chosen = pick.length ? pick : ranked.filter((row) => row.skill >= 0).slice(0, 2).map((row) => row.userId);

  if (loading) return <Loading />;
  if (error || !data) return <ErrorNote text={error || "Errore"} />;
  if (people.length === 0) return <Empty title="Ancora nessuno" text="Il primo account apre il gruppo. Gli altri si registrano da soli." />;

  const podium = (division: "" | "Madonne" | "Messeri" | "Pueri" | "Juniores") =>
    ranked.filter((row) => row.skill >= 0 && (division === "" || row.division === division)).slice(0, 3);

  function toggle(userId: string) {
    setPick((current) => {
      const base = current.length ? current : chosen;
      if (base.includes(userId)) return base.filter((id) => id !== userId);
      if (base.length >= 3) return base;
      return [...base, userId];
    });
  }

  const compared = people.filter((row) => chosen.includes(row.userId));
  const compareKeys = compared.map((row, index) => ({ key: row.userId, color: palette[index % palette.length] ?? ink.primary, name: axisName(row.name, compared.map((item) => item.name)) }));
  const volume = [
    { name: "Allenamenti", ...Object.fromEntries(compared.map((row) => [row.userId, row.sessions])) },
    { name: "Gare", ...Object.fromEntries(compared.map((row) => [row.userId, row.gare])) },
  ];
  const points = [{ name: "Campionato", ...Object.fromEntries(compared.map((row) => [row.userId, row.champ])) }];
  const shown = (face === "tutti" ? people : face === "scelta" ? people.filter((row) => picked.includes(row.userId)) : people.filter((row) => row.userId === me.userId))
    .filter((row) => (board === "sagoma" ? row.sagoma.length : row.shots.length))
    .sort((a, b) => (a.userId === me.userId ? -1 : b.userId === me.userId ? 1 : a.name.localeCompare(b.name, "it")));
  const paint = [...shown].sort((a, b) => (a.userId === me.userId ? 1 : b.userId === me.userId ? -1 : 0));
  const dots = paint.flatMap((row) => row.shots.map((shot) => ({ ...shot, color: row.userId === me.userId ? "#e07a2f" : row.color })));
  const sagomaShots = paint.flatMap((row) => row.sagoma).map((shot) => ({ score: shot.score, nx: shot.nx, ny: shot.ny }));

  return (
    <div className="grid gap-4">
      <PageHead title="Squadra" lede="Tutti gli account. Il podio segue i punti campionato. Se mancano, vale la media di gara, poi la media per freccia in allenamento." />
      <div className="grid gap-3 sm:grid-cols-2">
        <Podium title="Generale" rows={podium("")} />
        {DIVISIONS.map((name) => <Podium key={name} title={name} rows={podium(name)} />)}
      </div>

      <Card>
        <h2 className="font-display text-2xl">Bersaglio</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setBoard("padiglione")} className={`min-h-11 rounded-xl text-sm font-semibold ${board === "padiglione" ? "bg-primary text-primary-fg" : "border border-line"}`}>Padiglione</button>
          <button type="button" onClick={() => setBoard("sagoma")} className={`min-h-11 rounded-xl text-sm font-semibold ${board === "sagoma" ? "bg-primary text-primary-fg" : "border border-line"}`}>Sagome 3D</button>
        </div>
        <p className="mb-3 mt-2 text-sm text-muted">Prima i tuoi tiri, poi tutti, oppure solo chi scegli. Ci sono gli allenamenti e le gare.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {([["io", "I miei"], ["tutti", "Tutti"], ["scelta", "Scegli"]] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setFace(key)} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${face === key ? "bg-primary text-primary-fg" : "border border-line"}`}>{label}</button>
          ))}
        </div>
        {face === "scelta" ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {people.map((row) => {
              const on = picked.includes(row.userId);
              return (
                <button key={row.userId} type="button" onClick={() => setPicked((current) => on ? current.filter((id) => id !== row.userId) : [...current, row.userId])} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${on ? "bg-accent text-accent-fg" : "border border-line"}`}>
                  {row.userId === me.userId ? "Io" : row.name}
                  <span className="ml-1 tabular-nums opacity-70">{board === "sagoma" ? row.sagoma.length : row.shots.length}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {board === "sagoma" ? (
          sagomaShots.length ? <BoarTarget animal="sagome-3d" shots={sagomaShots} /> : <p className="text-sm text-muted">Nessun tiro di sagoma, per ora.</p>
        ) : (
          <svg viewBox="-1.12 -1.12 2.24 2.24" className="mx-auto aspect-square w-full max-w-sm" role="img" aria-label="Minimappa dei tiri">
            <circle cx="0" cy="0" r="1.08" fill="var(--elev)" />
            {RINGS.map((ring) => <circle key={ring.r} cx="0" cy="0" r={ring.r} fill={ring.fill} />)}
            <circle cx="0" cy="0" r="0.04" fill="#14181c" />
            {dots.map((shot, index) => <circle key={index} cx={shot.nx} cy={shot.ny} r="0.03" fill={shot.color} stroke="#14181c" strokeWidth="0.008" />)}
          </svg>
        )}
        {board === "padiglione" && dots.length === 0 ? <p className="mt-2 text-sm text-muted">Nessun punto sul bersaglio, per ora.</p> : null}
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {shown.map((row) => (
            <li key={row.userId} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
              {row.name}
              <span className="text-muted">{board === "sagoma" ? row.sagoma.length : row.shots.length}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-2xl">Chi tira di più</h2>
        {people.some((row) => row.arrows > 0) ? <DistBars data={people.filter((row) => row.arrows > 0).map((row) => ({ name: axisName(row.name, people.map((item) => item.name)), n: row.arrows }))} /> : <p className="text-sm text-muted">Ancora nessuna freccia.</p>}
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-2xl">Chi si allena di più</h2>
        {people.some((row) => row.sessions > 0) ? <DistBars data={people.filter((row) => row.sessions > 0).map((row) => ({ name: axisName(row.name, people.map((item) => item.name)), n: row.sessions }))} /> : <p className="text-sm text-muted">Ancora nessun allenamento.</p>}
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-2xl">Distanza migliore</h2>
        <p className="mb-2 text-sm text-muted">Il tiro più lungo, tra allenamenti e piazzole di gara.</p>
        {people.some((row) => row.bestDistance != null) ? <DistBars data={people.filter((row) => row.bestDistance != null).map((row) => ({ name: axisName(row.name, people.map((item) => item.name)), n: row.bestDistance ?? 0 }))} /> : <p className="text-sm text-muted">Ancora nessuna distanza segnata.</p>}
      </Card>
      <Card>
        <h2 className="mb-2 font-display text-2xl">Chi fa più gare</h2>
        {people.some((row) => row.gare > 0) ? <DistBars data={people.filter((row) => row.gare > 0).map((row) => ({ name: axisName(row.name, people.map((item) => item.name)), n: row.gare }))} /> : <p className="text-sm text-muted">Ancora nessuna gara segnata.</p>}
      </Card>

      <Card>
        <h2 className="font-display text-2xl">Confronto</h2>
        <p className="mb-3 text-sm text-muted">Fino a tre alla volta. {chosen.length >= 3 ? "Togli un nome per cambiarlo." : ""}</p>
        <div className="flex flex-wrap gap-2">
          {people.map((row) => {
            const on = chosen.includes(row.userId);
            return (
              <button key={row.userId} type="button" onClick={() => toggle(row.userId)} className={`min-h-11 rounded-full px-3 text-sm font-semibold ${on ? "bg-primary text-primary-fg" : "border border-line"}`}>
                {row.name}
              </button>
            );
          })}
        </div>
        {compared.length < 2 ? <p className="mt-3 text-sm text-muted">Scegli almeno due arcieri.</p> : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[18rem] text-left text-sm">
                <thead>
                  <tr className="text-muted">
                    <th className="py-2 pr-2 font-medium"> </th>
                    {compared.map((row) => <th key={row.userId} className="py-2 pr-2 font-semibold text-fg">{axisName(row.name, compared.map((item) => item.name))}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Allenamenti", (row: Archer) => String(row.sessions)],
                    ["Frecce", (row: Archer) => String(row.arrows)],
                    ["di cui allenamento", (row: Archer) => String(row.trainArrows)],
                    ["di cui gare", (row: Archer) => String(row.garaArrows)],
                    ["Media tiro", (row: Archer) => row.avg == null ? "—" : fmtAvg(row.avg)],
                    ["Gare", (row: Archer) => String(row.gare)],
                    ["Distanza migliore", (row: Archer) => row.bestDistance == null ? "—" : `${row.bestDistance} m`],
                    ["Punti campionato", (row: Archer) => String(row.champ)],
                    ["Media gara", (row: Archer) => row.compAvg == null ? "—" : fmtAvg(row.compAvg)],
                  ].map(([label, read]) => (
                    <tr key={String(label)} className="border-t border-line">
                      <th className="py-2 pr-2 text-left font-medium">{label as string}</th>
                      {compared.map((row) => <td key={row.userId} className="py-2 pr-2 tabular-nums">{(read as (row: Archer) => string)(row)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mb-2 mt-4 font-display text-xl">Allenamenti e gare</h3>
            <MultiBars data={volume} keys={compareKeys} />
            <h3 className="mb-2 mt-4 font-display text-xl">Punti campionato</h3>
            <MultiBars data={points} keys={compareKeys} />
          </>
        )}
      </Card>

      <div className="grid gap-2">
        {people.map((row) => (
          <Link key={row.id} to="/arciere/$id" params={{ id: String(row.id) }}>
            <Card className="flex items-center gap-3 p-3">
              <Avatar size="lg" label={row.name} color={row.avatarColor} photo={row.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-2xl leading-none">{row.name}</p>
                <p className="mt-1 text-xs text-muted">{[row.division, `${row.sessions} allenamenti`, `${row.arrows} frecce`, `${row.gare} gare`, row.bestDistance != null ? `${row.bestDistance} m` : ""].filter(Boolean).join(" · ")}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
      <SquadAnimals />
      <GadgetShelf />
      <ClubSpend />
    </div>
  );
}

function Podium({ title, rows }: { title: string; rows: Archer[] }) {
  const slots = [rows[1], rows[0], rows[2]];
  return (
    <Card>
      <h2 className="mb-3 font-display text-2xl">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">Nessuno con un risultato, per ora.</p> : (
        <div className="grid grid-cols-3 items-end gap-2">
          {slots.map((row, index) => {
            const place = index === 1 ? 1 : index === 0 ? 2 : 3;
            if (!row) return <div key={place} />;
            return (
              <Link key={row.userId} to="/arciere/$id" params={{ id: String(row.id) }} className={`aa-podium block rounded-2xl border-2 bg-bg/70 px-1 pb-2 pt-2 text-center ${place === 1 ? "min-h-40" : "min-h-28"}`} style={{ ["--metal" as string]: place === 1 ? "#e0b15a" : place === 2 ? "#c5ced6" : "#b87333" }}>
                <p className={`font-display text-3xl leading-none ${place === 1 ? "text-[#e0b15a]" : place === 2 ? "text-[#d5dde4]" : "text-[#c4844a]"}`}>{place}</p>
                <Avatar className="mx-auto mt-2" label={row.name} color={row.avatarColor} photo={row.photoUrl} />
                <p className="mt-1 truncate text-sm font-semibold">{row.name}</p>
                <p className="truncate text-[11px] text-muted">{row.mark}</p>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

const ORDER_LABEL: Record<string, string> = {
  penne: "Penne",
  aste: "Aste",
  punte: "Punte",
  cocche: "Cocche",
  flettenti: "Flettenti",
  altro: "Altro",
};

function SquadAnimals() {
  const board = useLoad("skill-board", () => skillBoard());
  const [animal, setAnimal] = useState(ANIMALS[13].id);
  const data = board.data;
  const face = ANIMALS.find((item) => item.id === animal) ?? ANIMALS[0];
  const people = data?.people ?? [];
  const nameOf = (userId: string) => {
    const person = people.find((item) => item.userId === userId);
    return person ? memberLabel(person, people) : "Arciere";
  };
  const ranked = (data?.animals ?? [])
    .filter((row) => animalByLabel(row.label).id === face.id)
    .map((row) => ({ ...row, avg: row.n ? row.points / row.n : 0 }))
    .sort((a, b) => b.avg - a.avg || b.points - a.points);
  const sagoma = [...(data?.sagoma ?? [])].filter((row) => row.n > 0).sort((a, b) => (b.points / b.n) - (a.points / a.n));
  return (
    <Card className="grid gap-3">
      <h2 className="font-display text-2xl">Sagome 3D</h2>
      <p className="text-sm text-muted">Media di tutti, su piazzole di ogni gara e tiri di sagoma di ogni allenamento.</p>
      {sagoma[0] ? (
        <ol className="grid gap-1 text-sm">
          {sagoma.slice(0, 8).map((row, index) => (
            <li key={row.userId} className="flex justify-between gap-3">
              <span className="truncate">{index + 1}. {nameOf(row.userId)}</span>
              <span className="shrink-0 tabular-nums text-muted">{(row.points / row.n).toFixed(1)} · {row.n}</span>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-muted">Nessun tiro di sagoma, per ora.</p>}
      <label className="grid gap-1 text-sm">
        <span className="text-muted">Chi è più bravo su un animale, tra tutte le gare</span>
        <select value={animal} onChange={(e) => setAnimal(e.target.value)} className="min-h-11 rounded-xl border border-line bg-transparent px-3">
          {ANIMALS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3">
        <img src={face.src} alt="" className="h-16 w-24 object-contain" />
        <div>
          {ranked[0] ? <p className="font-semibold">{nameOf(ranked[0].userId)} · {ranked[0].avg.toFixed(1)}</p> : <p className="text-sm text-muted">Nessuna piazzola su {face.label}.</p>}
        </div>
      </div>
    </Card>
  );
}

function GadgetShelf() {
  const board = useLoad("gadgets", () => listGadgets());
  const prizes = (board.data?.prizes ?? []).filter((prize) => prize.holders.length > 0);
  return (
    <Card>
      <h2 className="mb-2 font-display text-2xl">Premi</h2>
      <p className="mb-3 text-sm text-muted">Solo quelli già conquistati da qualcuno della squadra.</p>
      {prizes.length === 0 ? <p className="text-sm text-muted">Nessuno sbloccato, per ora.</p> : (
        <div className="grid grid-cols-2 gap-2">
          {prizes.map((prize) => (
            <div key={prize.code} className="rounded-xl border border-accent p-2">
              <div className="flex items-center gap-2">
                <PrizeMark code={prize.code} />
                <p className="min-w-0 truncate text-sm font-semibold">{prize.title}</p>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted">{prizeTier(prize.code).label}</p>
              <p className="mt-1 truncate text-xs">{prize.holders.map((holder) => holder.nickname || holder.givenName).join(", ")}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ClubSpend() {
  const [nonce, setNonce] = useState(0);
  const orders = useLoad(`orders-${nonce}`, () => listClubOrders());
  const [item, setItem] = useState("penne");
  const [qty, setQty] = useState("1");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  return (
    <Card className="grid gap-3">
      <h2 className="font-display text-2xl">Spesa comune</h2>
      <p className="text-sm text-muted">Penne, aste, punte: si scrive qui e si ordina insieme.</p>
      <div className="grid grid-cols-2 gap-2">
        <Select value={item} onChange={(e) => setItem(e.target.value)}>
          {Object.entries(ORDER_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </Select>
        <TextInput inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantità" />
      </div>
      <Field label="Nota"><TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="Marca, misura, colore" /></Field>
      {err ? <ErrorNote text={err} /> : null}
      <Button onClick={() => saveClubOrder({ data: { item, qty: Number(qty) || 1, note } }).then(() => { setNote(""); setNonce((n) => n + 1); }).catch((e: unknown) => setErr(e instanceof Error ? e.message : "Errore"))}>Aggiungi all'ordine</Button>
      {(orders.data ?? []).length === 0 ? <Empty title="Nessun ordine" text="Quando manca qualcosa, mettilo qui." /> : null}
      {(orders.data ?? []).map((row) => (
        <div key={row.id} className="rounded-xl border border-line p-2">
          <p className="font-semibold">{ORDER_LABEL[row.item] ?? row.item} × {row.qty}</p>
          <p className="text-xs text-muted">{memberLabel(row, orders.data ?? [])} · {row.status}{row.note ? ` · ${row.note}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["aperto", "Aperto"], ["ordinato", "Ordinato"], ["arrivato", "Arrivato"]] as const).map(([status, label]) => (
              <button key={status} type="button" className="min-h-10 rounded-full border border-line px-3 text-xs" onClick={() => setClubOrder({ data: { id: row.id, status } }).then(() => setNonce((n) => n + 1))}>{label}</button>
            ))}
            {row.mine ? <button type="button" className="text-xs text-danger" onClick={() => setClubOrder({ data: { id: row.id, remove: true } }).then(() => setNonce((n) => n + 1))}>Togli</button> : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
