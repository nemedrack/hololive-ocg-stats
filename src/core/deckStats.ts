import type { Tournament, Result } from "./types";

export type DeckTournamentStats = {
  did: string;
  deckName: string;

  players: number;     // cuántos jugadores lo jugaron
  metaShare: number;   // players / totalPlayers

  matches: number;     // matches jugados (sin BYE)
  wins: number;
  losses: number;
  draws: number;

  winRate: number;     // wins / matches (0..1). draws no suman win
};

export function computeDeckStats(t: Tournament): DeckTournamentStats[] {
  const totalPlayers = t.players.length || 1;

  // pid -> did
  const pidToDid = new Map<string, string>();
  for (const e of t.entries) pidToDid.set(e.pid, e.did);

  // did -> name
  const didToName = new Map<string, string>();
  for (const d of t.decks) didToName.set(d.did, d.name);

  // init stats for decks present in entries
  const stats = new Map<string, DeckTournamentStats>();

  function ensure(did: string) {
    if (!stats.has(did)) {
      stats.set(did, {
        did,
        deckName: didToName.get(did) ?? did,
        players: 0,
        metaShare: 0,
        matches: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        winRate: 0,
      });
    }
    return stats.get(did)!;
  }

  // meta: contar jugadores por deck
  for (const p of t.players) {
    const did = pidToDid.get(p.pid);
    if (!did) continue;
    ensure(did).players += 1;
  }

  // results: acumular por deck según resultado de match
  for (const rd of t.rounds) {
    for (const m of rd.matches) {
      const r = m.result as Result | undefined;
      if (!r) continue;
      if (r === "BYE") continue;      // BYE no cuenta como match para winrate de deck
      if (!m.b) continue;

      const didA = pidToDid.get(m.a);
      const didB = pidToDid.get(m.b);

      // si algún jugador no tiene deck asignado, saltamos el match para deck stats
      if (!didA || !didB) continue;

      const sA = ensure(didA);
      const sB = ensure(didB);

      sA.matches += 1;
      sB.matches += 1;

      if (r === "A") {
        sA.wins += 1;
        sB.losses += 1;
      } else if (r === "B") {
        sA.losses += 1;
        sB.wins += 1;
      } else if (r === "D") {
        sA.draws += 1;
        sB.draws += 1;
      }
    }
  }

  // calcular rates
  for (const s of stats.values()) {
    s.metaShare = s.players / totalPlayers;
    s.winRate = s.matches > 0 ? s.wins / s.matches : 0;
  }

  // orden sugerido: metaShare desc, winRate desc, matches desc
  return Array.from(stats.values()).sort((a, b) => {
    if (b.metaShare !== a.metaShare) return b.metaShare - a.metaShare;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return b.matches - a.matches;
  });
}
