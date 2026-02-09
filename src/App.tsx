import { useState } from "react";
import LiveTournament from "./pages/LiveTournament";
import ArchiveDashboard from "./pages/ArchiveDashboard";
import DeckLab from "./pages/DeckLab";

export default function App() {
  const [tab, setTab] = useState<"live" | "archive" | "decklab">("live");

  return (
    <div>
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <img src={`${import.meta.env.BASE_URL}brand/hololive-ocg.png`} alt="Hololive OCG" />
            <div>
              <div className="title">HoloStat</div>
              <div className="subtitle">Weekly tracker & meta stats</div>
            </div>
          </div>

          <div className="tabs">
            <button
              className={`btn ${tab === "live" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab("live")}
            >
              Live
            </button>
            <button
              className={`btn ${tab === "archive" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab("archive")}
            >
              Archive
            </button>
            <button
              className={`btn ${tab === "decklab" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab("decklab")}
            >
              Deck Lab
            </button>
          </div>
        </div>
      </div>

      <div className="page">
        {tab === "live" ? (
          <LiveTournament />
        ) : tab === "archive" ? (
          <ArchiveDashboard />
        ) : (
          <DeckLab />
        )}
      </div>
    </div>
  );
}
