import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CanopyGame from "../app/CanopyGame";
import NFTreeAccess from "../app/NFTreeAccess";
import { dAppKit } from "../app/dapp-kit";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../app/globals.css";

const queryClient = new QueryClient();

function App() {
  return (
    <main className="site-shell">
      <section className="game-frame" aria-label="TREE FORCE '89: Canopy Command">
        <header className="game-header">
          <span className="game-title">TREE FORCE ’89</span>
          <span className="game-subtitle">CANOPY COMMAND</span>
        </header>
        <NFTreeAccess />
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
      <p className="build-label">v0.5.8</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode><QueryClientProvider client={queryClient}><DAppKitProvider dAppKit={dAppKit}><App /></DAppKitProvider></QueryClientProvider></StrictMode>,
);
