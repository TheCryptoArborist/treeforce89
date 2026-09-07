import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CanopyGame from "../app/CanopyGame";
import "../app/globals.css";

function App() {
  return (
    <main className="site-shell">
      <section className="game-frame" aria-label="TREE FORCE '89: Canopy Command">
        <header className="game-header">
          <span className="game-title">TREE FORCE ’89</span>
          <span className="game-subtitle">CANOPY COMMAND</span>
        </header>
        <div className="screen-bezel">
          <div className="game-viewport">
            <CanopyGame />
            <div className="crt-lines" aria-hidden="true" />
          </div>
        </div>
        <footer className="game-controls">
          <span>MOVE A/D · ←/→</span>
          <span>FIRE Z/X · HOLD OR AUTO</span>
          <span>SHIELD SPACE · PAUSE ESC</span>
        </footer>
      </section>
      <p className="build-label">PREVIEW · ROUND PICKUPS</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><App /></StrictMode>,
);
