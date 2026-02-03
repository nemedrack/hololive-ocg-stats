import type { Tournament } from "./types";

export type TournamentIndexItem = {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  path: string; // relativo, ej: "data/tournaments/2026/02/xxx.json"
};

function withBase(path: string) {
  // Vite: en GH Pages BASE_URL suele ser "/repo/"
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
