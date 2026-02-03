import { useEffect, useMemo, useState } from "react";
import type { Match, Round, Tournament, Result } from "../core/types";
import { loadLive, saveLive, clearLive } from "../core/storage";
import { downloadTournamentJson } from "../core/exportJson";
import { computeStandings } from "../core/stats";
import { computeDeckStats } from "../core/deckStats";
import { computeDeckMatchups } from "../core/matchups";
import { loadDeckCatalog, type DeckCatalogItem } from "../core/deckCatalog";

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function makeEmptyTournament(): Tournament {
  const date = todayISO();
  return {
    id: `${date}_weekly_${uid("t").slice(-4)}`,
    name: "Weekly Hololive OCG",
    date,
    location: "",
    format: { type: "swiss", rounds: 4, rules: { winPoints: 3, drawPoints: 1, lossPoints: 0 } },
    players: [],
    decks: [],     // la vamos a poblar automáticamente según lo que se use
    entries: [],
    rounds: [],
    notes: "",
  };
}

type ResultModalState =
  | { open: false }
  | { open: true; roundIndex: number; matchId: string };

export default function LiveTournament() {
  const [t, setT] = useState<Tournament>(() => loadLive() ?? makeEmptyTournament());
  const [modal, setModal] = useState<ResultModalState>({ open: false });

  // --- Deck catalog ---
  const [catalog, setCatalog] = useState<DeckCatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const c = await loadDeckCatalog();
        // orden por nombre
        c.sort((a, b) => a.name.localeCompare(b.name));
        setCatalog(c);
      } catch (e: any) {
        setCatalogError(e?.message ?? "Error cargando catálogo de decks");
      }
    })();
  }, []);

  // Mantener t.decks como subconjunto de los decks usados (para export autocontenido)
  useEffect(() => {
    if (catalog.length === 0) return;

    const used = new Set(t.entries.map((e) => e.did));
    const subset = catalog
      .filter((c) => used.has(c.key))
      .map((c) => ({ did: c.key, name: c.name }));

    // evita loop: solo actualiza si cambió
    const same =
      subset.length === t.decks.length &&
      subset.every((d, i) => t.decks[i] && t.decks[i].did === d.did && t.decks[i].name === d.name);

    if (!same) {
      setT((prev) => ({ ...prev, decks: subset }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, t.entries]);

  useEffect(() => saveLive(t), [t]);

  const currentRoundIndex = useMemo(() => (t.rounds.length ? t.rounds.length - 1 : -1), [t.rounds.length]);
  const currentRound = currentRoundIndex >= 0 ? t.rounds[currentRoundIndex] : null;

  const standings = useMemo(() => computeStandings(t), [t]);
  const deckStats = useMemo(() => computeDeckStats(t), [t]);
  const matchups = useMemo(() => computeDeckMatchups(t), [t]);

  const didToName = useMemo(() => {
    // catálogo tiene prioridad; fallback a t.decks
    const m = new Map<string, string>();
    for (const c of catalog) m.set(c.key, c.name);
    for (const d of t.decks) if (!m.has(d.did)) m.set(d.did, d.name);
    return m;
  }, [catalog, t.decks]);

  function updateTournament(patch: (prev: Tournament) => Tournament) {
    setT((prev) => patch(prev));
  }

  // ---- Setup helpers ----
  function addPlayer(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateTournament((prev) => {
      const pid = uid("p");
      return { ...prev, players: [...prev.players, { pid, name: trimmed }] };
    });
  }

  function setEntry(pid: string, did: string) {
    updateTournament((prev) => {
      const entries = prev.entries.filter((e) => e.pid !== pid);
      if (did) entries.push({ pid, did });
      return { ...prev, entries };
    });
  }

  // ---- Rounds ----
  function startRoundWithEmptyMatches() {
    updateTournament((prev) => {
      const r = prev.rounds.length + 1;
      const newRound: Round = { r, locked: false, matches: [] };
      return { ...prev, rounds: [...prev.rounds, newRound] };
    });
  }

  function addMatchToCurrentRound(a: string, b?: string) {
    updateTournament((prev) => {
      const idx = prev.rounds.length - 1;
      if (idx < 0) return prev;
      const round = prev.rounds[idx];
      if (round.locked) return prev;

      const table = round.matches.length + 1;
      const m: Match = { mid: uid("m"), table, a, b, result: b ? undefined : "BYE" };
      const updatedRound = { ...round, matches: [...round.matches, m] };
      const rounds = prev.rounds.slice();
      rounds[idx] = updatedRound;
      return { ...prev, rounds };
    });
  }

  function setMatchResult(roundIndex: number, matchId: string, result: Result) {
    updateTournament((prev) => {
      const rounds = prev.rounds.slice();
      const round = rounds[roundIndex];
      if (!round || round.locked) return prev;

      const matches = round.matches.map((m) => (m.mid === matchId ? { ...m, result } : m));
      rounds[roundIndex] = { ...round, matches };
      return { ...prev, rounds };
    });
  }

  function closeCurrentRound() {
    updateTournament((prev) => {
      const idx = prev.rounds.length - 1;
      if (idx < 0) return prev;

      const round = prev.rounds[idx];
      const missing = round.matches.some((m) => m.b && !m.result);
      if (missing) return prev;

      const rounds = prev.rounds.slice();
      rounds[idx] = { ...round, locked: true };
      return { ...prev, rounds };
    });
  }

  function resetAll() {
    clearLive();
    setT(makeEmptyTournament());
  }

  const canStart = t.rounds.length === 0;
  const canCloseRound = !!currentRound && !currentRound.locked;
  const canCreateNextRound = !!currentRound && currentRound.locked && t.rounds.length < t.format.rounds;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0" }}>Hololive Tournament</h1>
          <div className="muted">
            Swiss · Bo1 · {t.format.rounds} rondas máx ·{" "}
            {currentRound ? (
              <span className="badge">
                Ronda {currentRound.r} {currentRound.locked ? "cerrada" : "abierta"}
              </span>
            ) : (
              <span className="badge">Sin iniciar</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={() => downloadTournamentJson(t)}>
            Exportar JSON
          </button>
          <button className="btn btn-danger" onClick={resetAll}>
            Reset
          </button>
        </div>
      </div>

      {/* Setup + Players/Decks */}
      <section className="grid-2" style={{ marginTop: 12 }}>
        <div className="card">
          <h2 className="h2">Setup</h2>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>Nombre</label>
            <input
              className="input"
              value={t.name}
              onChange={(e) => updateTournament((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div className="grid-2">
            <div className="field">
              <label>Fecha</label>
              <input className="input" value={t.date} onChange={(e) => updateTournament((p) => ({ ...p, date: e.target.value }))} />
            </div>

            <div className="field">
              <label>Rondas (3–5)</label>
              <input
                className="input"
                type="number"
                min={3}
                max={5}
                value={t.format.rounds}
                onChange={(e) =>
                  updateTournament((p) => ({ ...p, format: { ...p.format, rounds: Number(e.target.value) } }))
                }
              />
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={startRoundWithEmptyMatches} disabled={!canStart}>
              Iniciar (Ronda 1)
            </button>
            <button className="btn btn-ghost" onClick={closeCurrentRound} disabled={!canCloseRound}>
              Cerrar ronda
            </button>
            <button className="btn btn-ghost" onClick={startRoundWithEmptyMatches} disabled={!canCreateNextRound}>
              Crear siguiente ronda
            </button>
          </div>

          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          </p>
        </div>

        <div className="card">
          <h2 className="h2">Jugadores</h2>

          <AddRow placeholder="Agregar jugador (nombre)" onAdd={addPlayer} />

          <div style={{ marginTop: 12 }}>
            <h3 className="h2" style={{ marginBottom: 6 }}>
              Inscripciones (Deck)
            </h3>

            {catalogError && (
              <p className="muted" style={{ color: "#b91c1c" }}>
                {catalogError}
              </p>
            )}

            {t.players.length === 0 ? (
              <p className="muted">Agrega jugadores.</p>
            ) : catalog.length === 0 ? (
              <p className="muted">Cargando catálogo de decks…</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {t.players.map((p) => {
                  const current = t.entries.find((e) => e.pid === p.pid)?.did ?? "";
                  return (
                    <div key={p.pid} className="grid-2" style={{ gap: 10 }}>
                      <div style={{ alignSelf: "center" }}>{p.name}</div>

                      <select className="select" value={current} onChange={(e) => setEntry(p.pid, e.target.value)}>
                        <option value="">(sin deck)</option>
                        {catalog.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.name}{c.oshi ? ` — Oshi: ${c.oshi}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Current round */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Ronda actual</h2>

        {!currentRound ? (
          <p className="muted">Aún no inicias el torneo. Crea Ronda 1.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
              <span className="badge">Ronda {currentRound.r}</span>
              <span className="muted">{currentRound.locked ? "Cerrada" : "Abierta"}</span>
              <span className="muted">· Mesas: {currentRound.matches.length}</span>
            </div>

            <PairingBuilder
              disabled={currentRound.locked}
              players={t.players}
              onAddMatch={(a, b) => addMatchToCurrentRound(a, b)}
            />

            <div style={{ marginTop: 12 }}>
              {currentRound.matches.length === 0 ? (
                <p className="muted">Agrega pairings.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Mesa</th>
                      <th>A</th>
                      <th>B</th>
                      <th>Resultado</th>
                      <th style={{ textAlign: "right" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRound.matches.map((m) => (
                      <tr key={m.mid}>
                        <td>{m.table}</td>
                        <td>{nameOf(t.players, m.a)}</td>
                        <td>{m.b ? nameOf(t.players, m.b) : "-"}</td>
                        <td>
                          {m.result ? (
                            <span className="badge">{renderResult(m.result, t.players, m)}</span>
                          ) : (
                            <span className="muted">pendiente</span>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => setModal({ open: true, roundIndex: currentRoundIndex, matchId: m.mid })}
                            disabled={currentRound.locked || (!m.b && m.result === "BYE")}
                          >
                            Ingresar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </section>

      {/* Standings */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Standings</h2>

        {t.players.length === 0 ? (
          <p className="muted">Sin jugadores.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Jugador</th>
                <th>Pts</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>PJ</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.pid}>
                  <td>{i + 1}</td>
                  <td>{s.name}</td>
                  <td>
                    <b>{s.points}</b>
                  </td>
                  <td>{s.w}</td>
                  <td>{s.l}</td>
                  <td>{s.d}</td>
                  <td>{s.played}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Deck stats */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Meta & Winrate por Deck (Torneo Actual)</h2>

        {t.players.length === 0 ? (
          <p className="muted">Sin jugadores.</p>
        ) : deckStats.length === 0 ? (
          <p className="muted">Asigna decks en “Inscripciones” para calcular meta share y winrate.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Deck</th>
                <th>Players</th>
                <th>Meta</th>
                <th>W</th>
                <th>L</th>
                <th>D</th>
                <th>Matches</th>
                <th>Winrate</th>
              </tr>
            </thead>
            <tbody>
              {deckStats.map((s) => (
                <tr key={s.did}>
                  <td>{didToName.get(s.did) ?? s.deckName}</td>
                  <td>{s.players}</td>
                  <td>{Math.round(s.metaShare * 100)}%</td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                  <td>{s.draws}</td>
                  <td>{s.matches}</td>
                  <td>
                    {s.matches >= 3 ? `${Math.round(s.winRate * 100)}%` : "—"}
                    <span className="muted" style={{ marginLeft: 8 }}>
                      (N={s.matches})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
          BYE no cuenta para winrate de deck. Matches sin deck asignado se excluyen.
        </p>
      </section>

      {/* Matchups */}
      <section className="card" style={{ marginTop: 12 }}>
        <h2 className="h2">Matchups Deck vs Deck (torneo)</h2>

        {matchups.length === 0 ? (
          <p className="muted">Sin matchups aún (requiere resultados y decks asignados a ambos jugadores).</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Deck A</th>
                <th>Deck B</th>
                <th>Matches</th>
                <th>A Wins</th>
                <th>B Wins</th>
                <th>Draws</th>
                <th>A Winrate</th>
              </tr>
            </thead>
            <tbody>
              {matchups
                .filter((m) => m.matches >= 2)
                .map((m) => (
                  <tr key={`${m.aDid}||${m.bDid}`}>
                    <td>{didToName.get(m.aDid) ?? m.aDid}</td>
                    <td>{didToName.get(m.bDid) ?? m.bDid}</td>
                    <td>{m.matches}</td>
                    <td>{m.aWins}</td>
                    <td>{m.bWins}</td>
                    <td>{m.draws}</td>
                    <td>
                      {Math.round(m.aWinRate * 100)}%
                      <span className="muted" style={{ marginLeft: 8 }}>
                        (N={m.matches})
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}

        {matchups.length > 0 && (
          <p className="muted" style={{ marginTop: 10, marginBottom: 0 }}>
            Mostrando solo matchups con N≥2.
          </p>
        )}
      </section>

      {modal.open && currentRound && (
        <ResultModal
          match={currentRound.matches.find((m) => m.mid === modal.matchId)!}
          players={t.players}
          onClose={() => setModal({ open: false })}
          onSave={(res) => {
            setMatchResult(modal.roundIndex, modal.matchId, res);
            setModal({ open: false });
          }}
        />
      )}
    </div>
  );
}

/* ---------- Small components ---------- */

function AddRow({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="row">
      <div style={{ flex: 1, minWidth: 220 }}>
        <input className="input" value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} />
      </div>
      <button
        className="btn btn-ghost"
        onClick={() => {
          onAdd(v);
          setV("");
        }}
      >
        Agregar
      </button>
    </div>
  );
}

function PairingBuilder({
  disabled,
  players,
  onAddMatch,
}: {
  disabled: boolean;
  players: { pid: string; name: string }[];
  onAddMatch: (a: string, b?: string) => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");

  return (
    <div className="row">
      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="field">
          <label>A</label>
          <select className="select" value={a} onChange={(e) => setA(e.target.value)} disabled={disabled}>
            <option value="">(selecciona)</option>
            {players.map((p) => (
              <option key={p.pid} value={p.pid}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 220 }}>
        <div className="field">
          <label>B</label>
          <select className="select" value={b} onChange={(e) => setB(e.target.value)} disabled={disabled}>
            <option value="">(BYE / sin oponente)</option>
            {players.map((p) => (
              <option key={p.pid} value={p.pid}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        className="btn btn-primary"
        disabled={disabled || !a || a === b}
        onClick={() => {
          onAddMatch(a, b || undefined);
          setA("");
          setB("");
        }}
      >
        Agregar pairing
      </button>
    </div>
  );
}

function ResultModal({
  match,
  players,
  onClose,
  onSave,
}: {
  match: Match;
  players: { pid: string; name: string }[];
  onClose: () => void;
  onSave: (r: Result) => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(16, 18, 30, 0.45)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 50,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: 460,
          maxWidth: "95vw",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(10px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 6px 0" }}>Resultado · Mesa {match.table}</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {nameOf(players, match.a)} vs {match.b ? nameOf(players, match.b) : "BYE"}
        </p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => onSave("A")}>
            Gana A ({nameOf(players, match.a)})
          </button>
          {match.b && (
            <button className="btn btn-primary" onClick={() => onSave("B")}>
              Gana B ({nameOf(players, match.b)})
            </button>
          )}
          {match.b && (
            <button className="btn btn-ghost" onClick={() => onSave("D")}>
              Empate (D)
            </button>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "end", gap: 8, marginTop: 14 }}>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function nameOf(players: { pid: string; name: string }[], pid: string) {
  return players.find((p) => p.pid === pid)?.name ?? pid;
}

function renderResult(res: Result, players: { pid: string; name: string }[], m: Match) {
  if (res === "BYE") return "BYE (A)";
  if (res === "D") return "Empate";
  if (res === "A") return `Gana ${nameOf(players, m.a)}`;
  if (res === "B") return `Gana ${m.b ? nameOf(players, m.b) : "B"}`;
  return res;
}
