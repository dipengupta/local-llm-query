import { Fragment, useEffect, useRef, useState } from "react";
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

function compareTurnsDescending(left, right) {
  const timeDifference = new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  if (timeDifference !== 0) {
    return timeDifference;
  }
  return right.id - left.id;
}

function mergeTurns(currentTurns, incomingTurns) {
  const turnsById = new Map(currentTurns.map((turn) => [turn.id, turn]));
  incomingTurns.forEach((turn) => {
    turnsById.set(turn.id, turn);
  });
  return [...turnsById.values()].sort(compareTurnsDescending);
}

export default function HistoryDashboard({ onBack, buildConversationHref, buildNewChatHref }) {
  const [turns, setTurns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedTurnIds, setExpandedTurnIds] = useState([]);
  const [liveError, setLiveError] = useState("");
  const isActiveRef = useRef(true);
  const streamErrorCountRef = useRef(0);

  function toggleExpanded(turnId) {
    setExpandedTurnIds((current) =>
      current.includes(turnId) ? current.filter((id) => id !== turnId) : [...current, turnId],
    );
  }

  async function loadHistory({ showLoading = true, clearError = true } = {}) {
    if (showLoading) {
      setIsLoading(true);
    }
    if (clearError) {
      setError("");
    }

    try {
      const data = await getJson("/api/chat/turns/");
      if (!isActiveRef.current) {
        return;
      }
      setTurns((current) => mergeTurns(current, data));
    } catch (requestError) {
      if (!isActiveRef.current) {
        return;
      }
      setError(requestError.message);
    } finally {
      if (showLoading && isActiveRef.current) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    isActiveRef.current = true;
    loadHistory();

    return () => {
      isActiveRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }

    const eventSource = new EventSource("/api/chat/turns/stream/");

    function handleTurn(event) {
      if (!isActiveRef.current) {
        return;
      }
      try {
        const turn = JSON.parse(event.data);
        setTurns((current) => mergeTurns(current, [turn]));
        setError("");
        setIsLoading(false);
      } catch {
        // Ignore malformed stream events and wait for the next valid update.
      }
    }

    eventSource.addEventListener("turn", handleTurn);
    eventSource.onopen = () => {
      if (!isActiveRef.current) {
        return;
      }
      streamErrorCountRef.current = 0;
      setLiveError("");
    };
    eventSource.onerror = () => {
      if (!isActiveRef.current) {
        return;
      }
      streamErrorCountRef.current += 1;
      loadHistory({ showLoading: false, clearError: false });
      if (streamErrorCountRef.current >= 3) {
        setLiveError("Live updates are reconnecting.");
      }
    };

    return () => {
      eventSource.removeEventListener("turn", handleTurn);
      eventSource.close();
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
        {liveError ? (
          <p className="dashboard-live-status" role="status">
            {liveError}
          </p>
        ) : null}
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
