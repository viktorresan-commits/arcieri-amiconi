import assert from "node:assert/strict";
import test from "node:test";
import { elapsed, pauseClock, startClock } from "./clock.ts";
import { challengeScores, rulesFair } from "./challenge.ts";
import { simplePdf } from "./pdf.ts";
import { buildRanks, sortRanks } from "./rank.ts";
import { cursor, faceById, scoreAtRadius, summarize } from "./scoring.ts";

test("WA center is X ten and the outer ten is not", () => {
  const face = faceById("wa10");
  const center = scoreAtRadius(face, 0.01);
  assert.equal(center.isX, true);
  assert.equal(center.score, 10);
  const ten = scoreAtRadius(face, 0.08);
  assert.equal(ten.isX, false);
  assert.equal(ten.score, 10);
  assert.equal(scoreAtRadius(face, 1.2).miss, true);
});

test("end totals and average", () => {
  const shots = [10, 9, 8, 7, 6, 8].map((score, arrow) => ({ score, isX: score === 10, miss: false, block: 0, end: 0, arrow }));
  const tally = summarize(shots, 10);
  assert.equal(tally.points, 48);
  assert.equal(tally.arrows, 6);
  assert.ok(Math.abs(tally.avg - 8) < 1e-9);
  assert.equal(cursor(shots, 6, 6, 1).end, 1);
});

test("clock keeps time while the screen is locked", () => {
  const started = startClock({ running: false, startedAt: null, accumulatedMs: 0 }, 1_000);
  assert.equal(elapsed(started, 4_000), 3_000);
  const paused = pauseClock(started, 4_000);
  assert.equal(elapsed(paused, 9_000), 3_000);
});

test("challenge refuses mixed conditions and scores one round", () => {
  assert.ok(rulesFair({ metric: "total", arrows: null, distanceM: 18, bowType: "olimpico", face: "wa10", discipline: "indoor" }));
  const rule = { metric: "total" as const, arrows: 3, distanceM: 18, bowType: "olimpico", face: "wa10", discipline: "indoor" };
  const rows = challengeScores(rule, [
    {
      userId: "a",
      startedAt: "2026-11-01T10:00:00.000Z",
      distanceM: 18,
      bowType: "olimpico",
      face: "wa10",
      discipline: "indoor",
      shots: [
        { score: 10, isX: false, miss: false, block: 0, end: 0, arrow: 0 },
        { score: 10, isX: false, miss: false, block: 0, end: 0, arrow: 1 },
        { score: 10, isX: false, miss: false, block: 0, end: 0, arrow: 2 },
        { score: 1, isX: false, miss: false, block: 0, end: 1, arrow: 0 },
      ],
    },
    {
      userId: "b",
      startedAt: "2026-11-02T10:00:00.000Z",
      distanceM: 70,
      bowType: "olimpico",
      face: "wa10",
      discipline: "indoor",
      shots: [
        { score: 10, isX: false, miss: false, block: 0, end: 0, arrow: 0 },
        { score: 10, isX: false, miss: false, block: 0, end: 0, arrow: 1 },
        { score: 10, isX: false, miss: false, block: 0, end: 0, arrow: 2 },
      ],
    },
  ], "2026-11-01T00:00:00.000Z", "2026-11-30T00:00:00.000Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].userId, "a");
  assert.equal(rows[0].value, 30);
});

test("rank uses arrows weighted average", () => {
  const rows = sortRanks(buildRanks([
    { userId: "a", sessionId: 1, startedAt: "2026-11-02T10:00:00.000Z", maxArrow: 10, score: 10, isX: false, miss: false },
    { userId: "a", sessionId: 1, startedAt: "2026-11-02T10:00:00.000Z", maxArrow: 10, score: 8, isX: false, miss: false },
    { userId: "b", sessionId: 2, startedAt: "2026-11-02T11:00:00.000Z", maxArrow: 10, score: 10, isX: true, miss: false },
  ], [], 30), "avg");
  assert.equal(rows[0].userId, "b");
  assert.equal(rows[1].avg, 9);
});

test("pdf is a real file", () => {
  const bytes = simplePdf("Arcieri", ["Volée 48 su 60", "àèéìòù"]);
  const text = new TextDecoder().decode(bytes);
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.ok(text.includes("startxref"));
  assert.ok(text.includes("%%EOF"));
});
