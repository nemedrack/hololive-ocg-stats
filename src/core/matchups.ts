import type { Tournament, Result } from "./types";

export type DeckVsDeckCell = {
  aDid: string;
  bDid: string;
  matches: number;
  aWins: number;
  bWins: number;
  draws: number;
  aWinRate: number; // aWins / matches
};

export function computeDeckMatchups(t: Tournament): DeckVsDeckCell[] {
  const pidToDid = new Map<string, string>();
  for (const e of t.entries) pidToDid.set(e.pid, e.did);

  // clave normalizada "didA||didB" con didA<didB para agrupar
  const map = new Map<string, { did1: string; did2: string; m: number; w1: number; w2: number; d: number }>();

  function key(d1: string, d2: string) {
    return d1 < d2 ? `${d1}||${d2}` : `${d2}||${d1}`;
  }

  function ensure(d1: string, d2: string) {
    const k = key(d1, d2);
    if (!map.has(k)) {
      const did1 = d1 < d2 ? d1 : d2;
      const did2 = d1 < d2 ? d2 : d1;
      map.set(k, { did1, did2, m: 0, w1: 0, w2: 0, d: 0 });
    }
    return map.get(k)!;
  }

  for (const rd of t.rounds) {
    for (const match of rd.matches) {
      const r = match.result as Result | undefined;
      if (!r) continue;
      if (r === "BYE") continue;
      if (!match.b) continue;

      const didA = pidToDid.get(match.a);
      const didB = pidToDid.get(match.b);
      if (!didA || !didB) continue;

      const bucket = ensure(didA, didB);
      bucket.m += 1;

      if (r === "D") {
        bucket.d += 1;
      } else if (r === "A") {
        // gana A: suma win al deck de A
        if (bucket.did1 === didA) bucket.w1 += 1;
        else bucket.w2 += 1;
      } else if (r === "B") {
        // gana B: suma win al deck de B
        if (bucket.did1 === didB) bucket.w1 += 1;
        else bucket.w2 += 1;
      }
    }
  }

  const out: DeckVsDeckCell[] = [];
  for (const v of map.values()) {
    out.push({
      aDid: v.did1,
      bDid: v.did2,
      matches: v.m,
      aWins: v.w1,
      bWins: v.w2,
      draws: v.d,
      aWinRate: v.m > 0 ? v.w1 / v.m : 0,
    });
  }

  // orden: más jugados primero
  out.sort((x, y) => y.matches - x.matches);
  return out;
}
