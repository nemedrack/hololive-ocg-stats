import type { Tournament, Result } from "./types";

export type PlayerAgg = {
  pid: string;
  name: string;
  tournaments: number;
  matches: number;
  w: number;
  l: number;
  d: number;
  points: number;
  winRate: number; // w / matches
};

export type DeckAgg = {
  did: string;
  deckName: string;
  entries: number;   // cuántas veces aparece en inscripciones (1 por jugador por torneo)
  metaShare: number; // entries / totalEntries
  matches: number;
  w: number;
  l: number;
  d: number;
  winRate: number;   // w / matches
};

export function aggregatePlayersAndDecks(tournaments: Tournament[]) {
  const playerMap = new Map<string, PlayerAgg>();
  const deckMap = new Map<string, DeckAgg>();

  let totalEntries = 0;

  for (const t of tournaments) {
    // pid->deck y did->name
    const pidToDid = new Map<string, string>();
    for (const e of t.entries) pidToDid.set(e.pid, e.did);

    const didToName = new Map<string, string>();
    for (const d of t.decks) didToName.set(d.did, d.name);

    // entries/meta
    for (const p of t.players) {
      const did = pidToDid.get(p.pid);
      if (!did) continue;

      totalEntries += 1;

      if (!deckMap.has(did)) {
        deckMap.set(did, {
          did,
          deckName: didToName.get(did) ?? did,
          entries: 0,
          metaShare: 0,
          matches: 0,
          w: 0,
          l: 0,
          d: 0,
          winRate: 0,
        });
      }
      deckMap.get(did)!.entries += 1;
    }

    // init players
    for (const p of t.players) {
      if (!playerMap.has(p.pid)) {
        playerMap.set(p.pid, {
          pid: p.pid,
          name: p.name,
          tournaments: 0,
          matches: 0,
          w: 0,
          l: 0,
          d: 0,
          points: 0,
          winRate: 0,
        });
      }
    }
    // contar torneos por jugador (si participa)
    for (const p of t.players) {
      playerMap.get(p.pid)!.tournaments += 1;
    }

    const rules = t.format.rules;

    // matches
    for (const rd of t.rounds) {
      for (const m of rd.matches) {
        const r = m.result as Result | undefined;
        if (!r) continue;

        // BYE: suma a jugador (win + pts), pero NO a deck stats global (igual que local)
        if (r === "BYE") {
          const pa = playerMap.get(m.a);
          if (pa) {
            pa.matches += 1;
            pa.w += 1;
            pa.points += rules.winPoints;
          }
          continue;
        }

        if (!m.b) continue;

        const pa = playerMap.get(m.a);
        const pb = playerMap.get(m.b);
        if (!pa || !pb) continue;

        // actualizar player stats
        if (r === "A") {
          pa.matches += 1; pb.matches += 1;
          pa.w += 1; pb.l += 1;
          pa.points += rules.winPoints;
          pb.points += rules.lossPoints;
        } else if (r === "B") {
          pa.matches += 1; pb.matches += 1;
          pa.l += 1; pb.w += 1;
          pa.points += rules.lossPoints;
          pb.points += rules.winPoints;
        } else if (r === "D") {
          pa.matches += 1; pb.matches += 1;
          pa.d += 1; pb.d += 1;
          pa.points += rules.drawPoints;
          pb.points += rules.drawPoints;
        }

        // deck stats (solo si ambos tienen deck)
        const didA = pidToDid.get(m.a);
        const didB = pidToDid.get(m.b);
        if (!didA || !didB) continue;

        const da = deckMap.get(didA);
        const db = deckMap.get(didB);
        if (!da || !db) continue;

        da.matches += 1;
        db.matches += 1;

        if (r === "A") {
          da.w += 1; db.l += 1;
        } else if (r === "B") {
          da.l += 1; db.w += 1;
        } else {
          da.d += 1; db.d += 1;
        }
      }
    }
  }

  // compute rates
  const players = Array.from(playerMap.values()).map(p => ({
    ...p,
    winRate: p.matches > 0 ? p.w / p.matches : 0,
  })).sort((a, b) => {
    // orden: points desc, winrate desc, matches desc
    if (b.points !== a.points) return b.points - a.points;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });

  const decks = Array.from(deckMap.values()).map(d => ({
    ...d,
    metaShare: totalEntries > 0 ? d.entries / totalEntries : 0,
    winRate: d.matches > 0 ? d.w / d.matches : 0,
  })).sort((a, b) => {
    // orden: meta desc, winrate desc, matches desc
    if (b.metaShare !== a.metaShare) return b.metaShare - a.metaShare;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });

  return { players, decks, totalEntries };
}
