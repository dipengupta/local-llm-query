import { useEffect, useState } from "react";
import ChatScreen from "./components/ChatScreen";
import HistoryDashboard from "./components/HistoryDashboard";

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
    description: "Ask questions that must resolve against Social Committee Teams.",
    accent: "accent-cool",
  },
];

function parseHashRoute(hash) {
  const normalized = hash.startsWith("#") ? hash.slice(1) : hash;
  const path = normalized || "/";
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { view: "home", key: "home" };
  }

  if (segments[0] === "history") {
    return { view: "dashboard", key: "dashboard" };
  }

  if (segments[0] === "chat" && (segments[1] === "general" || segments[1] === "query")) {
    if (segments[2] === "new") {
      return {
        view: "chat",
        key: path,
        mode: segments[1],
        conversationId: null,
        resumeLatest: false,
      };
    }

    if (segments[2] === "conversation" && /^\d+$/.test(segments[3] ?? "")) {
      return {
        view: "chat",
        key: path,
        mode: segments[1],
        conversationId: Number(segments[3]),
        resumeLatest: false,
      };
    }

    return {
      view: "chat",
      key: path,
      mode: segments[1],
      conversationId: null,
      resumeLatest: true,
    };
  }

  return { view: "home", key: "home" };
}

function navigateTo(hash) {
  window.location.hash = hash;
}

function buildChatHref(mode, options = {}) {
  if (options.conversationId) {
    return `#/chat/${mode}/conversation/${options.conversationId}`;
  }

  if (options.resumeLatest === false) {
    return `#/chat/${mode}/new`;
  }

  return `#/chat/${mode}`;
}

export default function App() {
  const [screen, setScreen] = useState(() => parseHashRoute(window.location.hash));

  useEffect(() => {
    function handleHashChange() {
      setScreen(parseHashRoute(window.location.hash));
    }

    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  if (screen.view === "chat") {
    return (
      <main className="app-frame">
        <ChatScreen
          key={screen.key}
          mode={screen.mode}
          initialConversationId={screen.conversationId}
          resumeLatest={screen.resumeLatest}
          onBack={() => navigateTo("#/")}
        />
      </main>
    );
  }

  if (screen.view === "dashboard") {
    return (
      <main className="app-frame">
        <HistoryDashboard
          onBack={() => navigateTo("#/")}
          buildConversationHref={(conversation) =>
            buildChatHref(conversation.mode, {
              conversationId: conversation.id,
              resumeLatest: false,
            })
          }
          buildNewChatHref={(mode) =>
            buildChatHref(mode, {
              conversationId: null,
              resumeLatest: false,
            })
          }
        />
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
        <a className="dashboard-link" href="#/history">
          Open history dashboard
        </a>
      </section>

      <section className="card-grid">
        {CARDS.map((card) => (
          <a
            key={card.id}
            className={`mode-card ${card.accent}`}
            href={buildChatHref(card.id, {
              conversationId: null,
              resumeLatest: true,
            })}
          >
            <span className="card-kicker">Mode</span>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
