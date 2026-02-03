import type { Tournament } from "./types";

export function downloadTournamentJson(t: Tournament) {
  const blob = new Blob([JSON.stringify(t, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${t.id}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
