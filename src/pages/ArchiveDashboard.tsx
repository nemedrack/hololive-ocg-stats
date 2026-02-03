import { useEffect, useMemo, useState } from "react";
import { loadTournamentIndex, loadTournament, type TournamentIndexItem } from "../core/archive";
import { aggregatePlayersAndDecks } from "../core/aggregate";
import type { Tournament } from "../core/types";
import MetaPie from "../components/MetaPie";
import DeckWinrateBar from "../components/DeckWinrateBar";
import { loadDeckCatalog, buildDeckCatalogIndex, type DeckCatalogItem } from "../core/deckCatalog";


function ym(date: string) {
  return date.slice(0, 7);
}

type FilterMode = "month" | "lastN" | "single";

export default function ArchiveDashboard() {
  const [index, setIndex] = useState<TournamentIndexItem[]>([]);
  const [selectedYM, setSelectedYM] = useState<string>("");
  const [mode, setMode] = useState<FilterMode>("month");
  const [lastN, setLastN] = useState(4);
  const [selectedId, setSelectedId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState<string>("");

  const [catalog, setCatalog] = useState<DeckCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState("");

  const catalogIndex = useMemo(() => buildDeckCatalogIndex(catalog), [catalog]);
  

  useEffect(() => {
    (async () => {
      try {
        const c = await loadDeckCatalog();
        setCatalog(c);
      } catch (e: any) {
        setCatalogError(e?.message ?? "Error cargando catálogo decks");
      }
    })();
  }, []);


  useEffect(() => {
    (async () => {
      try {
        const idx = await loadTournamentIndex();
        idx.sort((a, b) => b.date.localeCompare(a.date));
        setIndex(idx);
        const firstYM = idx.length ? ym(idx[0].date) : "";
        setSelectedYM(firstYM);

        const firstId = idx.length ? idx[0].id : "";
        setSelectedId(firstId);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando index");
      }
    })();
  }, []);

  const yms = useMemo(() => {
    const set = new Set(index.map((i) => ym(i.date)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [index]);

  const filtered = useMemo(() => {
    if (index.length === 0) return [];

    if (mode === "single") {
      if (!selectedId) return [];
      return index.filter(i => i.id === selectedId);
    }

    if (mode === "lastN") return index.slice(0, lastN);

    // month
    if (!selectedYM) return [];
    return index.filter(i => ym(i.date) === selectedYM);
  }, [index, mode, lastN, selectedYM, selectedId]);

  // OJO: antes dependías de selectedYM y eso rompe cuando mode=lastN.
  // Ahora dependemos de filtered (si cambia el modo, cambia filtered).
  useEffect(() => {
    (async () => {
      if (filtered.length === 0) {
        setTournaments([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const loaded = await Promise.all(filtered.map(loadTournament));
        loaded.sort((a, b) => a.date.localeCompare(b.date));
        setTournaments(loaded);
      } catch (e: any) {
        setError(e?.message ?? "Error cargando torneos");
      } finally {
        setLoading(false);
      }
    })();
  }, [filtered]);

  const agg = useMemo(() => aggregatePlayersAndDecks(tournaments), [tournaments]);

  const decksByMeta = useMemo(() => {
    return [...agg.decks].sort((a, b) => b.metaShare - a.metaShare);
  }, [agg.decks]);

  const decksByWinrate = useMemo(() => {
    return [...agg.decks].filter((d) => d.matches >= 6).sort((a, b) => b.winRate - a.winRate);
  }, [agg.decks]);

  const decksByDominance = useMemo(() => {
    return [...agg.decks]
      .filter((d) => d.matches >= 6)
      .map((d) => ({ ...d, dominance: d.metaShare * d.winRate }))
      .sort((a, b) => (b.dominance ?? 0) - (a.dominance ?? 0));
  }, [agg.decks]);

  type PieItem = { name: string; value: number; color?: string; oshi?: string; icon?: string };

  const pieData = useMemo<PieItem[]>(() => {
    const top = decksByMeta.slice(0, 8);
    const rest = decksByMeta.slice(8);
    const restSum = rest.reduce((a, d) => a + d.metaShare, 0);

    const out: PieItem[] = top.map(d => {
      const cat = catalogIndex.byName.get(catalogIndex.norm(d.deckName));
      return {
        name: cat?.name ?? d.deckName,
        value: Math.round(d.metaShare * 1000) / 10,
        color: cat?.color,
        oshi: cat?.oshi,
        icon: cat?.icon,
      };
    });

    if (restSum > 0) {
      out.push({ name: "Otros", value: Math.round(restSum * 1000) / 10, color: "#9aa3b2" });
    }

    return out;
  }, [decksByMeta, catalogIndex]);


  const winrateBarData = useMemo(() => {
    return decksByDominance.slice(0, 10).map((d) => ({
      name: d.deckName,
      winratePct: Math.round(d.winRate * 100),
      matches: d.matches,
    }));
  }, [decksByDominance]);

  const headerBadge = useMemo(() => {
    if (mode === "lastN") return `Últimos ${lastN}`;
    if (mode === "month") return selectedYM || "—";

    const one = index.find(i => i.id === selectedId);
    return one ? one.date : "—";
  }, [mode, lastN, selectedYM, index, selectedId]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0" }}>Archive</h1>
          <div className="muted">
            Estadísticas globales · <span className="badge">{headerBadge}</span>
            <span className="muted" style={{ marginLeft: 10 }}>
              {loading ? "Cargando..." : `${tournaments.length} torneo(s)`}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(220,38,38,0.25)" }}>
          <b style={{ color: "#b91c1c" }}>Error</b>
          <div className="muted" style={{ marginTop: 6 }}>
            {error}
          </div>
        </div>
      )}

      {/* Filtros */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Filtros</h2>

        <div className="row">
          <div className="field" style={{ minWidth: 220 }}>
            <label>Modo</label>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value as FilterMode)}>
              <option value="month">Mes</option>
              <option value="lastN">Últimos N torneos</option>
              <option value="single">Torneo</option>
            </select>
          </div>

          {mode === "month" ? (
            <div className="field" style={{ minWidth: 220 }}>
              <label>Mes</label>
              <select className="select" value={selectedYM} onChange={(e) => setSelectedYM(e.target.value)}>
                {yms.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ) : mode === "lastN" ? (
            <div className="field" style={{ minWidth: 120 }}>
              <label>N</label>
              <select className="select" value={lastN} onChange={(e) => setLastN(Number(e.target.value))}>
                {[4, 6, 8, 12].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ) : (
            <div className="field" style={{ minWidth: 360 }}>
              <label>Torneo</label>
              <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {index.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.date} — {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="muted" style={{ alignSelf: "end" }}>
            {index.length === 0 ? "No hay index" : `${filtered.length} torneo(s) seleccionados`}
          </div>
        </div>
      </section>

      {/* Lista torneos */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Torneos seleccionados</h2>
        {filtered.length === 0 ? (
          <p className="muted">No hay torneos para este filtro.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {filtered.map((i) => (
              <li key={i.id}>
                <span className="badge" style={{ marginRight: 8 }}>
                  {i.date}
                </span>
                {i.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Top Decks: 3 mini tablas */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Top Decks</h2>

        {agg.decks.length === 0 ? (
          <p className="muted">Sin datos aún (revisa que entries/decks estén completos).</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <MiniDeckTable title="Por Meta Share" rows={decksByMeta.slice(0, 5)} />
            <MiniDeckTable title="Por Winrate (N≥6)" rows={decksByWinrate.slice(0, 5)} />
            <MiniDeckTable title="Por Dominancia" rows={decksByDominance.slice(0, 5)} showDominance />
          </div>
        )}

        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          Winrate se muestra solo con muestra suficiente (N≥6).
        </p>
      </section>

      {/* Tabla completa */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Decks (detalle)</h2>

        {agg.decks.length === 0 ? (
          <p className="muted">Sin datos.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Deck</th>
                <th>Entries</th>
                <th>Meta</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Matches</th>
                <th>Winrate</th>
              </tr>
            </thead>
            <tbody>
              {decksByMeta.map((d) => (
                <tr key={d.did}>
                  <td>{d.deckName}</td>
                  <td>{d.entries}</td>
                  <td>{Math.round(d.metaShare * 100)}%</td>
                  <td>{d.w}</td>
                  <td>{d.l}</td>
                  <td>{d.d}</td>
                  <td>{d.matches}</td>
                  <td>
                    {d.matches >= 6 ? `${Math.round(d.winRate * 100)}%` : "—"}
                    <span className="muted" style={{ marginLeft: 8 }}>
                      (N={d.matches})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Charts */}
      <section className="grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <h2 className="h2">Meta Share</h2>
          <MetaPie data={pieData} />
        </div>

        <div className="card">
          <h2 className="h2">Top Winrate</h2>
          <DeckWinrateBar data={winrateBarData} />
        </div>
      </section>
    </div>
  );
}

/* ---------- MiniDeckTable ---------- */

function MiniDeckTable({
  title,
  rows,
  showDominance,
}: {
  title: string;
  rows: any[];
  showDominance?: boolean;
}) {
  return (
    <div className="card" style={{ padding: 12, boxShadow: "var(--shadow-soft)" }}>
      <h3 style={{ margin: "0 0 10px 0", fontSize: 14 }}>{title}</h3>

      {rows.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No hay decks que cumplan el umbral.
        </p>
      ) : (
        <table className="table" style={{ fontSize: 13 }}>
          <thead>
            <tr>
              <th>Deck</th>
              <th>Meta</th>
              <th>WR</th>
              {showDominance && <th>Score</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.did}>
                <td>{d.deckName}</td>
                <td>{Math.round(d.metaShare * 100)}%</td>
                <td>
                  {d.matches >= 6 ? `${Math.round(d.winRate * 100)}%` : "—"}
                  <span className="muted" style={{ marginLeft: 8 }}>
                    (N={d.matches})
                  </span>
                </td>
                {showDominance && <td>{Math.round((d.dominance ?? 0) * 1000) / 1000}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
