export type Clock = {
  running: boolean;
  startedAt: number | null;
  accumulatedMs: number;
};

export function freshClock(): Clock {
  return { running: false, startedAt: null, accumulatedMs: 0 };
}

export function elapsed(clock: Clock, now: number) {
  if (!clock.running || clock.startedAt == null) return clock.accumulatedMs;
  return clock.accumulatedMs + Math.max(0, now - clock.startedAt);
}

export function startClock(clock: Clock, now: number): Clock {
  if (clock.running) return clock;
  return { running: true, startedAt: now, accumulatedMs: clock.accumulatedMs };
}

export function pauseClock(clock: Clock, now: number): Clock {
  return { running: false, startedAt: null, accumulatedMs: elapsed(clock, now) };
}
