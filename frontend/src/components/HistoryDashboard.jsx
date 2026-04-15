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

export default function HistoryDashboard({ onBack, buildConversationHref, buildNewChatHref }) {
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedConversationIds, setExpandedConversationIds] = useState([]);

  function toggleExpanded(conversationId) {
    setExpandedConversationIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId],
    );
  }

  useEffect(() => {
    let isActive = true;

    async function loadHistory() {
      setIsLoading(true);
      setError("");
      try {
        const data = await getJson("/api/chat/conversations/");
        if (!isActive) {
          return;
        }
        setConversations(data);
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

      {!isLoading && !error && conversations.length === 0 ? (
        <div className="empty-state">
          <p>No saved conversations yet. Start a chat to build history here.</p>
        </div>
      ) : null}

      {!isLoading && !error && conversations.length > 0 ? (
        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th scope="col">Mode</th>
                <th scope="col">Title</th>
                <th scope="col">Latest question</th>
                <th scope="col">Latest answer</th>
                <th scope="col">Turns</th>
                <th scope="col">Updated</th>
                <th scope="col">Details</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {conversations.map((conversation) => {
                const isExpanded = expandedConversationIds.includes(conversation.id);
                return (
                  <Fragment key={conversation.id}>
                    <tr>
                      <td>{MODE_LABELS[conversation.mode]}</td>
                      <td>{conversation.title}</td>
                      <td className="history-cell-text">{conversation.latest_question}</td>
                      <td className="history-cell-text history-cell-muted">{conversation.latest_answer}</td>
                      <td>{conversation.turn_count}</td>
                      <td>{formatTimestamp(conversation.updated_at)}</td>
                      <td>
                        <button
                          className="history-expand-button"
                          type="button"
                          aria-expanded={isExpanded}
                          onClick={() => toggleExpanded(conversation.id)}
                        >
                          {isExpanded ? "Hide" : "Show"}
                        </button>
                      </td>
                      <td>
                        <a className="history-open-link" href={buildConversationHref(conversation)}>
                          Open
                        </a>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="history-expanded-row">
                        <td colSpan={8}>
                          <div className="history-expanded-grid">
                            <section>
                              <div className="query-label">Full question</div>
                              <p>{conversation.latest_question}</p>
                            </section>
                            <section>
                              <div className="query-label">Full answer</div>
                              <p>{conversation.latest_answer}</p>
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
