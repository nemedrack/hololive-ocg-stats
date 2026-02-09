import type { Tournament } from "./types";

export type TournamentIndexItem = {
  id: string;
  date: string;
  name: string;
  path: string;
};

function withBase(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

export async function loadTournamentIndex(): Promise<TournamentIndexItem[]> {
  const res = await fetch(withBase("data/tournaments/index.json"));
  if (!res.ok) throw new Error("No se pudo cargar data/tournaments/index.json");
  return res.json();
}

export async function loadTournament(item: TournamentIndexItem): Promise<Tournament> {
  const res = await fetch(withBase(item.path));
  if (!res.ok) throw new Error(`No se pudo cargar torneo: ${item.path}`);
  return res.json();
}
