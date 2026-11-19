export type Ymd = { y: number; m: number; d: number };

export function romeParts(date: Date) {
  const bag = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    y: Number(bag.year),
    m: Number(bag.month),
    d: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
  };
}

export function romeYmd(date = new Date()): Ymd {
  const p = romeParts(date);
  return { y: p.y, m: p.m, d: p.d };
}

export function romeHour(date = new Date()) {
  return romeParts(date).hour;
}

export function romeDayKey(iso: string) {
  const p = romeYmd(new Date(iso));
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function ymdAdd(y: number, m: number, d: number, days: number): Ymd {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** UTC instant of midnight in Europe/Rome for a civil date. */
export function romeMidnightUtc(y: number, m: number, d: number) {
  const utcGuess = Date.UTC(y, m - 1, d, 0, 0, 0);
  const p = romeParts(new Date(utcGuess));
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.hour, p.minute, 0);
  return new Date(utcGuess - (asUtc - utcGuess));
}

export function romeWeekdayMon0(y: number, m: number, d: number) {
  const noon = new Date(romeMidnightUtc(y, m, d).getTime() + 12 * 3600 * 1000);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    weekday: "short",
  }).format(noon);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

export function monthGrid(y: number, m: number) {
  const first = romeWeekdayMon0(y, m, 1);
  const start = ymdAdd(y, m, 1, -first);
  const cells: Array<Ymd & { inMonth: boolean; key: string }> = [];
  for (let i = 0; i < 42; i++) {
    const cell = ymdAdd(start.y, start.m, start.d, i);
    const key = `${cell.y}-${String(cell.m).padStart(2, "0")}-${String(cell.d).padStart(2, "0")}`;
    cells.push({ ...cell, inMonth: cell.m === m && cell.y === y, key });
  }
  return cells;
}

export type PeriodKind = "day" | "week" | "month" | "year" | "all";

export function periodBounds(kind: PeriodKind, now = new Date()) {
  if (kind === "all") {
    return { from: null as string | null, to: null as string | null, prevFrom: null as string | null, prevTo: null as string | null, days: 0 };
  }
  const today = romeYmd(now);
  let start = today;
  if (kind === "month") start = { y: today.y, m: today.m, d: 1 };
  if (kind === "year") start = { y: today.y, m: 1, d: 1 };
  if (kind === "week") start = ymdAdd(today.y, today.m, today.d, -romeWeekdayMon0(today.y, today.m, today.d));
  const fromDate = romeMidnightUtc(start.y, start.m, start.d);
  let endYmd: Ymd;
  if (kind === "day") endYmd = ymdAdd(start.y, start.m, start.d, 1);
  else if (kind === "week") endYmd = ymdAdd(start.y, start.m, start.d, 7);
  else if (kind === "month") endYmd = today.m === 12 ? { y: today.y + 1, m: 1, d: 1 } : { y: today.y, m: today.m + 1, d: 1 };
  else endYmd = { y: today.y + 1, m: 1, d: 1 };
  const endDate = romeMidnightUtc(endYmd.y, endYmd.m, endYmd.d);
  const len = endDate.getTime() - fromDate.getTime();
  const prevFrom = new Date(fromDate.getTime() - len);
  return {
    from: fromDate.toISOString(),
    to: endDate.toISOString(),
    prevFrom: prevFrom.toISOString(),
    prevTo: fromDate.toISOString(),
    days: Math.max(1, Math.round(len / 86_400_000)),
  };
}

export function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function fmtDay(isoOrDay: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDay)) {
    const [y, m, d] = isoOrDay.split("-").map(Number);
    return new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(romeMidnightUtc(y, m, d + 0));
  }
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(isoOrDay));
}

export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

export function greet(hour: number) {
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}
