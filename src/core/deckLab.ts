import type { Tournament } from "./types";

export type DeckVsRow = {
  opponentDid: string;
  matches: number;
  w: number;
  l: number;
  d: number;
  winRate: number; // (w + 0.5*d)/matches
};

export type DeckVsSummary = {
  did: string;
  tournaments: number;
  matches: number;
  w: number;
  l: number;
  d: number;
  winRate: number;
};

export type DeckVsFieldResult = {
  summary: DeckVsSummary;
  rows: DeckVsRow[];
};

export type TrendPoint = {
  ym: string; // YYYY-MM
  matches: number;
  w: number;
  l: number;
  d: number;
  winRate: number;
};

export function ym(date: string) {
  return date.slice(0, 7);
}

function calcWR(w: number, l: number, d: number) {
  const m = w + l + d;
  return m > 0 ? (w + 0.5 * d) / m : 0;
}

function buildPidToDid(t: Tournament) {
  const map = new Map<string, string>();
  for (const e of t.entries ?? []) map.set(e.pid, e.did);
  return map;
}

type LocalAgg = { matches: number; w: number; l: number; d: number };

function applyResultToSelected(
  result: string,
  selectedOnA: boolean,
  selectedOnB: boolean
): { w: number; l: number; d: number } {
  // result: "A" | "B" | "D" | "BYE"
  let w = 0;
  let l = 0;
  let d = 0;

  if (result === "D") {
    d = 1;
    return { w, l, d };
  }

  if (result === "A") {
    if (selectedOnA) w = 1;
    else if (selectedOnB) l = 1;
    return { w, l, d };
  }

  if (result === "B") {
    if (selectedOnB) w = 1;
    else if (selectedOnA) l = 1;
    return { w, l, d };
  }

  return { w, l, d };
}

export function computeDeckVsField(tournaments: Tournament[], selectedDid: string): DeckVsFieldResult {
  const vs = new Map<string, LocalAgg>();
  let totalW = 0,
    totalL = 0,
    totalD = 0,
    totalM = 0;

  for (const t of tournaments) {
    const pidToDid = buildPidToDid(t);

    for (const r of t.rounds ?? []) {
      for (const m of r.matches ?? []) {
        if (!m?.b) continue;
        if (!m?.result) continue;
        if (m.result === "BYE") continue;

        const didA = pidToDid.get(m.a);
        const didB = pidToDid.get(m.b);
        if (!didA || !didB) continue;

        const selectedOnA = didA === selectedDid;
        const selectedOnB = didB === selectedDid;
        if (!selectedOnA && !selectedOnB) continue;

        const oppDid = selectedOnA ? didB : didA;

        const { w, l, d } = applyResultToSelected(m.result, selectedOnA, selectedOnB);

        const agg = vs.get(oppDid) ?? { matches: 0, w: 0, l: 0, d: 0 };
        agg.matches += 1;
        agg.w += w;
        agg.l += l;
        agg.d += d;
        vs.set(oppDid, agg);

        totalM += 1;
        totalW += w;
        totalL += l;
        totalD += d;
      }
    }
  }

  const rows: DeckVsRow[] = Array.from(vs.entries()).map(([opponentDid, a]) => ({
    opponentDid,
    matches: a.matches,
    w: a.w,
    l: a.l,
    d: a.d,
    winRate: calcWR(a.w, a.l, a.d),
  }));

  rows.sort((x, y) => y.matches - x.matches);

  return {
    summary: {
      did: selectedDid,
      tournaments: tournaments.length,
      matches: totalM,
      w: totalW,
      l: totalL,
      d: totalD,
      winRate: calcWR(totalW, totalL, totalD),
    },
    rows,
  };
}

export function computeDeckTrendByMonth(
  tournaments: Tournament[],
  selectedDid: string,
  opponentDid?: string
): TrendPoint[] {
  const byYM = new Map<string, LocalAgg>();

  for (const t of tournaments) {
    const k = ym(t.date);
    const pidToDid = buildPidToDid(t);

    for (const r of t.rounds ?? []) {
      for (const m of r.matches ?? []) {
        if (!m?.b) continue;
        if (!m?.result) continue;
        if (m.result === "BYE") continue;

        const didA = pidToDid.get(m.a);
        const didB = pidToDid.get(m.b);
        if (!didA || !didB) continue;

        const selectedOnA = didA === selectedDid;
        const selectedOnB = didB === selectedDid;
        if (!selectedOnA && !selectedOnB) continue;

        const opp = selectedOnA ? didB : didA;
        if (opponentDid && opp !== opponentDid) continue;

        const { w, l, d } = applyResultToSelected(m.result, selectedOnA, selectedOnB);

        const agg = byYM.get(k) ?? { matches: 0, w: 0, l: 0, d: 0 };
        agg.matches += 1;
        agg.w += w;
        agg.l += l;
        agg.d += d;
        byYM.set(k, agg);
      }
    }
  }

  const out: TrendPoint[] = Array.from(byYM.entries()).map(([k, a]) => ({
    ym: k,
    matches: a.matches,
    w: a.w,
    l: a.l,
    d: a.d,
    winRate: calcWR(a.w, a.l, a.d),
  }));

  out.sort((a, b) => a.ym.localeCompare(b.ym));
  return out;
}
