import { Fragment, useEffect, useState } from "react";
import { getJson } from "../lib/api";

const MODE_LABELS = {
  general: "General",
  query: "Query Agent",
};

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function getSessionMarkerStyle(conversationId) {
  const hue = (conversationId * 47) % 360;
  return {
    "--session-marker": `hsl(${hue} 45% 52%)`,
  };
}

export default function HistoryDashboard({ onBack, buildConversationHref, buildNewChatHref }) {
  const [turns, setTurns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedTurnIds, setExpandedTurnIds] = useState([]);

  function toggleExpanded(turnId) {
    setExpandedTurnIds((current) =>
      current.includes(turnId) ? current.filter((id) => id !== turnId) : [...current, turnId],
    );
  }

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      setIsLoading(true);
      setError("");
      try {
        const data = await getJson("/api/chat/turns/");
        if (!isActive) {
          return;
        }
        setTurns(data);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        setError(requestError.message);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadHistory();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <section className="dashboard-shell">
      <header className="dashboard-header">
        <button className="back-button" onClick={onBack} type="button">
          Back
        </button>
        <div>
          <p className="eyebrow">History</p>
          <h2>Conversation dashboard</h2>
        </div>
      </header>

      <section className="dashboard-toolbar" aria-label="Dashboard actions">
        <a className="toolbar-link" href={buildNewChatHref("general")}>
          New General chat
        </a>
        <a className="toolbar-link" href={buildNewChatHref("query")}>
          New Query Agent chat
        </a>
      </section>

      {isLoading ? (
        <div className="empty-state">
          <p>Loading saved conversations...</p>
        </div>
      ) : null}

      {error ? <div className="error-banner">{error}</div> : null}

      {!isLoading && !error && turns.length === 0 ? (
        <div className="empty-state">
          <p>No saved turns yet. Start a chat to build history here.</p>
        </div>
      ) : null}

      {!isLoading && !error && turns.length > 0 ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">Mode</th>
                <th scope="col">Question</th>
                <th scope="col">Answer</th>
                <th scope="col">Asked</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {turns.map((turn) => {
                const isExpanded = expandedTurnIds.includes(turn.id);
                return (
                  <Fragment key={turn.id}>
                    <tr className="history-row" style={getSessionMarkerStyle(turn.conversation_id)}>
                      <td className="history-mode-cell">{MODE_LABELS[turn.mode]}</td>
                      <td className="history-cell-text">
                        <div className={`history-cell-clamped ${isExpanded ? "history-cell-unclamped" : ""}`}>
                          {turn.question}
                        </div>
                      </td>
                      <td className="history-cell-text history-cell-muted">
                        <div className={`history-cell-clamped ${isExpanded ? "history-cell-unclamped" : ""}`}>
                          {turn.answer}
                        </div>
                      </td>
                      <td>{formatTimestamp(turn.created_at)}</td>
                      <td className="history-actions-cell">
                        <button
                          className="history-expand-button"
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(turn.id)}
                        >
                          {isExpanded ? "Collapse" : "Expand"}
                        </button>
                        <a
                          className="history-open-link"
                          href={buildConversationHref({ id: turn.conversation_id, mode: turn.mode })}
                        >
                          Open
                        </a>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="history-expanded-row" style={getSessionMarkerStyle(turn.conversation_id)}>
                        <td colSpan={5}>
                          <div className="history-expanded-grid">
                            <section>
                              <div className="query-label">Question</div>
                              <p>{turn.question}</p>
                            </section>
                            <section>
                              <div className="query-label">Answer</div>
                              <p>{turn.answer}</p>
                            </section>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
