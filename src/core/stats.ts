import type { Tournament, Result } from "./types";

export type PlayerStanding = {
  pid: string;
  name: string;
  w: number;
  l: number;
  d: number;
  points: number;
  played: number;
};

export function computeStandings(t: Tournament): PlayerStanding[] {
  const rules = t.format.rules;

  const map = new Map<string, PlayerStanding>();
  for (const p of t.players) {
    map.set(p.pid, {
      pid: p.pid,
      name: p.name,
      w: 0,
      l: 0,
      d: 0,
      points: 0,
      played: 0,
    });
  }

  function apply(pid: string, res: "W" | "L" | "D") {
    const s = map.get(pid);
    if (!s) return;
    s.played += 1;
    if (res === "W") {
      s.w += 1;
      s.points += rules.winPoints;
    } else if (res === "L") {
      s.l += 1;
      s.points += rules.lossPoints;
    } else {
      s.d += 1;
      s.points += rules.drawPoints;
    }
  }

  for (const rd of t.rounds) {
    for (const m of rd.matches) {
      const r = m.result as Result | undefined;
      if (!r) continue;

      if (r === "BYE") {
        apply(m.a, "W");
        continue;
      }

      if (!m.b) continue;

      if (r === "A") {
        apply(m.a, "W");
        apply(m.b, "L");
      } else if (r === "B") {
        apply(m.a, "L");
        apply(m.b, "W");
      } else if (r === "D") {
        apply(m.a, "D");
        apply(m.b, "D");
      }
    }
  }

  return Array.from(map.values()).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.w !== x.w) return y.w - x.w;
    return x.name.localeCompare(y.name);
  });
}
