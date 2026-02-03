export type DeckCatalogItem = {
  key: string;
  name: string;
  oshi?: string;
  color?: string;
  icon?: string;      // <-- nuevo (ruta bajo /public)
  aliases?: string[];
};

function withBase(path: string) {
  return `${import.meta.env.BASE_URL}${path}`;
}

export async function loadDeckCatalog(): Promise<DeckCatalogItem[]> {
  const res = await fetch(withBase("data/config/decks.json"));
  if (!res.ok) throw new Error("No se pudo cargar data/config/decks.json");
  return res.json();
}

export function buildDeckCatalogIndex(items: DeckCatalogItem[]) {
  const byName = new Map<string, DeckCatalogItem>();

  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[’']/g, "'");

  for (const it of items) {
    byName.set(norm(it.name), it);
    for (const a of it.aliases ?? []) byName.set(norm(a), it);
  }

  return { byName, norm };
}
