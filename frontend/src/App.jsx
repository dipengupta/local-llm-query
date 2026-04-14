import { useState } from "react";
import ChatScreen from "./components/ChatScreen";

const CARDS = [
  {
    id: "general",
    title: "General",
    description: "Talk to the local model like a normal assistant.",
    accent: "accent-warm",
  },
  {
    id: "query",
    title: "Query Agent",
    description: "Ask questions that must resolve against the Postgres dataset.",
    accent: "accent-cool",
  },
];

export default function App() {
  const [mode, setMode] = useState(null);

  if (mode) {
    return (
      <main className="app-frame">
        <ChatScreen mode={mode} onBack={() => setMode(null)} />
      </main>
    );
  }

  return (
    <main className="app-frame">
      <section className="hero">
        <p className="eyebrow">Local LLM Query</p>
        <h1>Choose how you want to use the model.</h1>
        <p className="hero-copy">
          One path is for open-ended conversation. The other is constrained to your imported social data and must
          answer from the database.
        </p>
      </section>

      <section className="card-grid">
        {CARDS.map((card) => (
          <button key={card.id} className={`mode-card ${card.accent}`} type="button" onClick={() => setMode(card.id)}>
            <span className="card-kicker">Mode</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </button>
        ))}
      </section>
    </main>
  );
}
