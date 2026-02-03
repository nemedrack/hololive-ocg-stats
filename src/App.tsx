import { useState } from "react";
import LiveTournament from "./pages/LiveTournament";
import ArchiveDashboard from "./pages/ArchiveDashboard";

export default function App() {
  const [tab, setTab] = useState<"live" | "archive">("live");

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
          </div>
        </div>
      </div>

      <div className="page">
        {tab === "live" ? <LiveTournament /> : <ArchiveDashboard />}
      </div>
    </div>
  );
}
