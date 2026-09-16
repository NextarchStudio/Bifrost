import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function App() {
  return (
    <main className="mx-auto max-w-4xl px-8 py-48">
      <p className="text-xs font-bold tracking-[.16em] text-emerald-300">BIFROST V2</p>
      <h1 className="my-4 max-w-3xl text-5xl font-bold leading-none text-slate-100 md:text-7xl">Teknisk fundament er klart</h1>
      <p className="text-lg text-slate-400">Web-klienten snakker med Bifrost-API på {apiUrl}.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
