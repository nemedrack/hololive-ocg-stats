import { useEffect, useMemo, useState } from "react";
import type { Tournament } from "../core/types";
import { loadTournamentIndex, loadTournament, type TournamentIndexItem } from "../core/archive";
import { loadDeckCatalog, type DeckCatalogItem } from "../core/deckCatalog";
import { computeDeckTrendByMonth, computeDeckVsField, ym as ymFn } from "../core/deckLab";
import type { DeckVsRow } from "../core/deckLab";

type FilterMode = "month" | "lastN" | "single";

function errMsg(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message || fallback;
  if (typeof e === "string") return e || fallback;
  return fallback;
}

export default function DeckLab() {
  const [index, setIndex] = useState<TournamentIndexItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [error, setError] = useState("");

  const [catalog, setCatalog] = useState<DeckCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState("");

  const [mode, setMode] = useState<FilterMode>("month");
  const [selectedYM, setSelectedYM] = useState("");
  const [lastN, setLastN] = useState(4);
  const [selectedId, setSelectedId] = useState("");

  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [opponentDeck, setOpponentDeck] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const idx = await loadTournamentIndex();
        idx.sort((a, b) => b.date.localeCompare(a.date));
        setIndex(idx);
        setSelectedYM(idx.length ? ymFn(idx[0].date) : "");
        setSelectedId(idx.length ? idx[0].id : "");
      } catch (e: unknown) {
        setError(errMsg(e, "Error cargando index"));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const c = await loadDeckCatalog();
        c.sort((a, b) => a.name.localeCompare(b.name));
        setCatalog(c);
        setSelectedDeck((prev) => prev || (c[0]?.key ?? ""));
      } catch (e: unknown) {
        setCatalogError(errMsg(e, "Error cargando catálogo decks"));
      }
    })();
  }, []);

  const yms = useMemo(() => {
    const set = new Set(index.map((i) => ymFn(i.date)));
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [index]);

  const filteredIndex = useMemo(() => {
    if (index.length === 0) return [];
    if (mode === "lastN") return index.slice(0, lastN);
    if (mode === "single") return selectedId ? index.filter((i) => i.id === selectedId) : [];
    if (!selectedYM) return [];
    return index.filter((i) => ymFn(i.date) === selectedYM);
  }, [index, mode, lastN, selectedId, selectedYM]);

  useEffect(() => {
    (async () => {
      if (filteredIndex.length === 0) {
        setTournaments([]);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const loaded = await Promise.all(filteredIndex.map(loadTournament));
        loaded.sort((a, b) => a.date.localeCompare(b.date));
        setTournaments(loaded);
      } catch (e: unknown) {
        setError(errMsg(e, "Error cargando torneos"));
      } finally {
        setLoading(false);
      }
    })();
  }, [filteredIndex]);

  const didToMeta = useMemo(() => {
    const map = new Map<string, DeckCatalogItem>();
    for (const c of catalog) map.set(c.key, c);
    return map;
  }, [catalog]);

  const selectedDeckName = didToMeta.get(selectedDeck)?.name ?? selectedDeck;
  const opponentDeckName = didToMeta.get(opponentDeck)?.name ?? opponentDeck;

  const vsField = useMemo(() => {
    if (!selectedDeck) return null;
    return computeDeckVsField(tournaments, selectedDeck);
  }, [tournaments, selectedDeck]);

  const [minN, setMinN] = useState(2);
  const [sortBy, setSortBy] = useState<"matches" | "wr">("matches");

  const rows = useMemo(() => {
    if (!vsField) return [];
    const base = vsField.rows.filter((r) => r.matches >= minN);
    const sorted = [...base];
    if (sortBy === "wr") sorted.sort((a, b) => b.winRate - a.winRate);
    else sorted.sort((a, b) => b.matches - a.matches);
    return sorted;
  }, [vsField, minN, sortBy]);

  const trend = useMemo(() => {
    if (!selectedDeck) return [];
    const opp = opponentDeck || undefined;
    return computeDeckTrendByMonth(tournaments, selectedDeck, opp);
  }, [tournaments, selectedDeck, opponentDeck]);

  const bestWorst = useMemo<{ best: DeckVsRow[]; worst: DeckVsRow[] }>(() => {
    if (!vsField) return { best: [], worst: [] };

    const eligible = vsField.rows.filter((r) => r.matches >= Math.max(3, minN));
    const byWR = [...eligible].sort((a, b) => b.winRate - a.winRate);

    return {
        best: byWR.slice(0, 3),
        worst: byWR.slice(-3).reverse(),
    };
    }, [vsField, minN]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0" }}>Deck Lab</h1>
          <div className="muted">
            Matchups y ventanas de tiempo ·{" "}
            {loading ? <span className="badge">Cargando…</span> : <span className="badge">{tournaments.length} torneo(s)</span>}
          </div>
        </div>
      </div>

      {(error || catalogError) && (
        <div className="card" style={{ marginTop: 12, borderColor: "rgba(220,38,38,0.25)" }}>
          <b style={{ color: "#b91c1c" }}>Errores</b>
          {error && <div className="muted" style={{ marginTop: 6 }}>{error}</div>}
          {catalogError && <div className="muted" style={{ marginTop: 6 }}>{catalogError}</div>}
        </div>
      )}

      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Selección</h2>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 220 }}>
            <label>Deck</label>
            <select className="select" value={selectedDeck} onChange={(e) => setSelectedDeck(e.target.value)}>
              {catalog.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ minWidth: 220 }}>
            <label>Ventana</label>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value as FilterMode)}>
              <option value="month">Mes</option>
              <option value="lastN">Últimos N torneos</option>
              <option value="single">Torneo</option>
            </select>
          </div>

          {mode === "month" ? (
            <div className="field" style={{ minWidth: 180 }}>
              <label>Mes</label>
              <select className="select" value={selectedYM} onChange={(e) => setSelectedYM(e.target.value)}>
                {yms.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          ) : mode === "lastN" ? (
            <div className="field" style={{ minWidth: 140 }}>
              <label>N</label>
              <select className="select" value={lastN} onChange={(e) => setLastN(Number(e.target.value))}>
                {[4, 6, 8, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="field" style={{ minWidth: 340 }}>
              <label>Torneo</label>
              <select className="select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {index.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.date} — {i.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="row" style={{ marginTop: 10, flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 140 }}>
            <label>Min N</label>
            <select className="select" value={minN} onChange={(e) => setMinN(Number(e.target.value))}>
              {[1, 2, 3, 4, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ minWidth: 180 }}>
            <label>Orden</label>
            <select
                className="select"
                value={sortBy}
                onChange={(e) => {
                    const v = e.target.value;
                    if (v === "matches" || v === "wr") setSortBy(v);
                }}
                >
                <option value="matches">Por muestra (N)</option>
                <option value="wr">Por winrate</option>
            </select>
          </div>

          <div className="muted" style={{ alignSelf: "end" }}>
            {selectedDeck ? (
              <>
                Analizando <span className="badge">{selectedDeckName}</span>
              </>
            ) : (
              "Selecciona un deck."
            )}
          </div>
        </div>
      </section>

      <section className="grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <h2 className="h2">Resumen</h2>
          {!vsField ? (
            <p className="muted">Sin datos (selecciona deck y ventana).</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Torneos</span>
                <b>{vsField.summary.tournaments}</b>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Matches</span>
                <b>{vsField.summary.matches}</b>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">W / L / D</span>
                <b>
                  {vsField.summary.w} / {vsField.summary.l} / {vsField.summary.d}
                </b>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted">Winrate</span>
                <b>{Math.round(vsField.summary.winRate * 100)}%</b>
              </div>
              <p className="muted" style={{ margin: 0 }}>
                BYE se excluye. Matches sin deck asignado se excluyen.
              </p>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="h2">Mejores / Peores (con muestra)</h2>
          {!vsField || vsField.rows.length === 0 ? (
            <p className="muted">Sin datos aún.</p>
          ) : (
            <div className="grid-2" style={{ gap: 10 }}>
              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Mejores</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {bestWorst.best.map((r) => (
                    <li key={`b-${r.opponentDid}`}>
                      {didToMeta.get(r.opponentDid)?.name ?? r.opponentDid} — <b>{Math.round(r.winRate * 100)}%</b>{" "}
                      <span className="muted">(N={r.matches})</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="muted" style={{ marginBottom: 6 }}>Peores</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {bestWorst.worst.map((r) => (
                    <li key={`w-${r.opponentDid}`}>
                      {didToMeta.get(r.opponentDid)?.name ?? r.opponentDid} — <b>{Math.round(r.winRate * 100)}%</b>{" "}
                      <span className="muted">(N={r.matches})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Matchups vs Field</h2>

        {!vsField ? (
          <p className="muted">Sin datos.</p>
        ) : rows.length === 0 ? (
          <p className="muted">No hay matchups que cumplan Min N={minN}.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Oponente</th>
                <th>N</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>WR</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.opponentDid}>
                  <td>{didToMeta.get(r.opponentDid)?.name ?? r.opponentDid}</td>
                  <td>{r.matches}</td>
                  <td>{r.w}</td>
                  <td>{r.l}</td>
                  <td>{r.d}</td>
                  <td>
                    <b>{Math.round(r.winRate * 100)}%</b>
                    <span className="muted" style={{ marginLeft: 8 }}>
                      (N={r.matches})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Tendencia por mes</h2>

        <div className="row" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ minWidth: 320 }}>
            <label>Oponente (opcional)</label>
            <select className="select" value={opponentDeck} onChange={(e) => setOpponentDeck(e.target.value)}>
              <option value="">(vs todo el field)</option>
              {catalog
                .filter((c) => c.key !== selectedDeck)
                .map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="muted" style={{ alignSelf: "end" }}>
            {opponentDeck ? (
              <>
                {selectedDeckName} vs <span className="badge">{opponentDeckName}</span>
              </>
            ) : (
              <>Winrate mensual de {selectedDeckName} vs field</>
            )}
          </div>
        </div>

        {trend.length === 0 ? (
          <p className="muted" style={{ marginTop: 10 }}>
            No hay suficientes matches en la ventana seleccionada.
          </p>
        ) : (
          <table className="table" style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th>Mes</th>
                <th>N</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>WR</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((p) => (
                <tr key={p.ym}>
                  <td>{p.ym}</td>
                  <td>{p.matches}</td>
                  <td>{p.w}</td>
                  <td>{p.l}</td>
                  <td>{p.d}</td>
                  <td>
                    <b>{Math.round(p.winRate * 100)}%</b>
                    <span className="muted" style={{ marginLeft: 8 }}>(N={p.matches})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
