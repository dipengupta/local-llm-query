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

function compareTurnsAscending(left, right) {
  const timeDifference = new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  if (timeDifference !== 0) {
    return timeDifference;
  }
  return left.id - right.id;
}

function compareSessionsDescending(left, right) {
  const timeDifference = new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
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

function buildSessionGroups(turns) {
  const sessionsById = new Map();

  turns.forEach((turn) => {
    const sessionId = turn.conversation_id;
    const existing = sessionsById.get(sessionId);
    const updatedAt = turn.conversation_updated_at || turn.created_at;
    const turnCount = Number(turn.turn_count) || 0;

    if (existing) {
      existing.turns.push(turn);
      existing.turn_count = Math.max(existing.turn_count, turnCount);
      if (new Date(updatedAt).getTime() > new Date(existing.updated_at).getTime()) {
        existing.updated_at = updatedAt;
      }
      return;
    }

    sessionsById.set(sessionId, {
      id: sessionId,
      mode: turn.mode,
      title: turn.title,
      updated_at: updatedAt,
      turn_count: turnCount,
      turns: [turn],
    });
  });

  return [...sessionsById.values()]
    .map((session) => ({
      ...session,
      turn_count: Math.max(session.turn_count, session.turns.length),
      turns: session.turns.sort(compareTurnsAscending),
    }))
    .sort(compareSessionsDescending);
}

export default function HistoryDashboard({ onBack, buildConversationHref, buildNewChatHref }) {
  const [turns, setTurns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedTurnIds, setExpandedTurnIds] = useState([]);
  const [collapsedSessionIds, setCollapsedSessionIds] = useState([]);
  const [liveError, setLiveError] = useState("");
  const isActiveRef = useRef(true);
  const streamErrorCountRef = useRef(0);
  const sessions = buildSessionGroups(turns);

  function toggleExpanded(turnId) {
    setExpandedTurnIds((current) =>
      current.includes(turnId) ? current.filter((id) => id !== turnId) : [...current, turnId],
    );
  }

  function toggleSession(sessionId) {
    setCollapsedSessionIds((current) =>
      current.includes(sessionId) ? current.filter((id) => id !== sessionId) : [...current, sessionId],
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
          <p>No saved sessions yet. Start a chat to build history here.</p>
        </div>
      ) : null}

      {!isLoading && !error && sessions.length > 0 ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Question</th>
                <th scope="col">Answer</th>
                <th scope="col">Asked</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const isSessionCollapsed = collapsedSessionIds.includes(session.id);
                return (
                  <Fragment key={session.id}>
                    <tr className="history-session-row" style={getSessionMarkerStyle(session.id)}>
                      <td colSpan={5}>
                        <div className="history-session-summary">
                          <button
                            className="history-session-toggle"
                            type="button"
                            aria-expanded={!isSessionCollapsed}
                            onClick={() => toggleSession(session.id)}
                          >
                            {isSessionCollapsed ? "Expand session" : "Collapse session"}
                          </button>
                          <div className="history-session-main">
                            <div className="history-session-title">
                              <span>{MODE_LABELS[session.mode]}</span>
                              {session.title}
                            </div>
                            <div className="history-session-meta">
                              {session.turn_count} {session.turn_count === 1 ? "turn" : "turns"} | Updated{" "}
                              {formatTimestamp(session.updated_at)}
                            </div>
                          </div>
                          <a
                            className="history-open-link"
                            href={buildConversationHref({ id: session.id, mode: session.mode })}
                          >
                            Open session
                          </a>
                        </div>
                      </td>
                    </tr>
                    {isSessionCollapsed
                      ? null
                      : session.turns.map((turn, index) => {
                          const isExpanded = expandedTurnIds.includes(turn.id);
                          return (
                            <Fragment key={turn.id}>
                              <tr className="history-turn-row" style={getSessionMarkerStyle(session.id)}>
                                <td className="history-turn-index">Turn {index + 1}</td>
                                <td className="history-cell-text">
                                  <div
                                    className={`history-cell-clamped ${
                                      isExpanded ? "history-cell-unclamped" : ""
                                    }`}
                                  >
                                    {turn.question}
                                  </div>
                                </td>
                                <td className="history-cell-text history-cell-muted">
                                  <div
                                    className={`history-cell-clamped ${
                                      isExpanded ? "history-cell-unclamped" : ""
                                    }`}
                                  >
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
                                    {isExpanded ? "Collapse turn" : "Expand turn"}
                                  </button>
                                </td>
                              </tr>
                              {isExpanded ? (
                                <tr className="history-turn-expanded-row" style={getSessionMarkerStyle(session.id)}>
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
