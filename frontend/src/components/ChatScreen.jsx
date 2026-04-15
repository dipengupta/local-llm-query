import { useEffect, useRef, useState } from "react";
import { getJson, postJson } from "../lib/api";

const MODE_CONFIG = {
  general: {
    label: "General",
    endpoint: "/api/chat/general/",
    placeholder: "Ask anything you want to explore locally.",
    heading: "Local model chat",
  },
  query: {
    label: "Query Agent",
    endpoint: "/api/chat/query/",
    placeholder: "Ask a question about Social Committee Teams.",
    heading: "Database-grounded answers only",
  },
};

function MessageBubble({ role, label, children, rawSql, sql, rows }) {
  return (
    <article className={`message message-${role}`}>
      <div className="message-meta">{label}</div>
      <p>{children}</p>
      {rawSql && rawSql !== sql ? (
        <div className="query-details">
          <div className="query-label">Raw SQL</div>
          <pre>{rawSql}</pre>
        </div>
      ) : null}
      {sql ? (
        <div className="query-details">
          <div className="query-label">Executed SQL</div>
          <pre>{sql}</pre>
          <details>
            <summary>Rows ({rows?.length ?? 0})</summary>
            <pre>{JSON.stringify(rows, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </article>
  );
}

function Turn({ turn, mode }) {
  return (
    <>
      <MessageBubble role="user" label="You">
        {turn.question}
      </MessageBubble>
      <MessageBubble
        role="assistant"
        label={MODE_CONFIG[mode].label}
        rawSql={turn.raw_sql}
        sql={turn.sql}
        rows={turn.rows}
      >
        {turn.answer}
      </MessageBubble>
    </>
  );
}

function LoadingMessage({ mode }) {
  return (
    <article className="message message-assistant message-loading" role="status" aria-live="polite">
      <div className="message-meta">{MODE_CONFIG[mode].label}</div>
      <div className="loading-copy">
        <span className="spinner" aria-hidden="true" />
        <p>Fetching result...</p>
      </div>
    </article>
  );
}

export default function ChatScreen({ mode, onBack, initialConversationId = null, resumeLatest = false }) {
  const [turns, setTurns] = useState([]);
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");
  const messageListRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  useEffect(() => {
    let isActive = true;

    async function loadConversation() {
      setTurns([]);
      setConversationId(initialConversationId);
      setPendingQuestion("");
      setError("");

      if (!initialConversationId && !resumeLatest) {
        return;
      }

      setIsLoadingConversation(true);
      try {
        const url = initialConversationId
          ? `/api/chat/conversations/${initialConversationId}/`
          : `/api/chat/conversations/latest/?mode=${mode}`;
        const data = await getJson(url);
        if (!isActive) {
          return;
        }
        setConversationId(data.id);
        setTurns(data.turns ?? []);
      } catch (requestError) {
        if (!isActive) {
          return;
        }
        if (!initialConversationId && requestError.status === 404) {
          setTurns([]);
        } else {
          setError(requestError.message);
        }
      } finally {
        if (isActive) {
          setIsLoadingConversation(false);
        }
      }
    }

    loadConversation();
    return () => {
      isActive = false;
    };
  }, [initialConversationId, mode, resumeLatest]);

  useEffect(() => {
    if (typeof bottomAnchorRef.current?.scrollIntoView === "function") {
      bottomAnchorRef.current.scrollIntoView({ block: "end" });
    } else if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [turns, pendingQuestion, isLoadingConversation]);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending || isLoadingConversation) {
      return;
    }

    setPendingQuestion(trimmed);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const data = await postJson(MODE_CONFIG[mode].endpoint, {
        question: trimmed,
        ...(conversationId ? { conversation_id: conversationId } : {}),
      });

      setConversationId(data.conversation_id);
      setTurns((current) => [
        ...current,
        {
          question: trimmed,
          answer: data.answer,
          raw_sql: data.raw_sql,
          sql: data.sql,
          rows: data.rows ?? [],
        },
      ]);
    } catch (requestError) {
      if (mode === "query" && requestError.data?.sql) {
        setTurns((current) => [
          ...current,
          {
            question: trimmed,
            answer: requestError.message,
            raw_sql: requestError.data.sql,
            sql: requestError.data.sql,
            rows: [],
          },
        ]);
      } else {
        setError(requestError.message);
      }
    } finally {
      setPendingQuestion("");
      setIsSending(false);
    }
  }

  return (
    <section className="chat-shell">
      <header className="chat-header">
        <button className="back-button" onClick={onBack} type="button">
          Back
        </button>
        <div>
          <p className="eyebrow">{MODE_CONFIG[mode].label}</p>
          <h2>{MODE_CONFIG[mode].heading}</h2>
        </div>
      </header>

      <div className="message-list" ref={messageListRef}>
        {isLoadingConversation ? (
          <div className="empty-state">
            <p>Loading conversation history...</p>
          </div>
        ) : null}

        {!isLoadingConversation && turns.length === 0 && !pendingQuestion ? (
          <div className="empty-state">
            <p>{MODE_CONFIG[mode].placeholder}</p>
          </div>
        ) : null}

        {turns.map((turn, index) => (
          <Turn key={`${turn.created_at ?? "turn"}-${index}`} turn={turn} mode={mode} />
        ))}

        {pendingQuestion ? (
          <>
            <MessageBubble role="user" label="You">
              {pendingQuestion}
            </MessageBubble>
            <LoadingMessage mode={mode} />
          </>
        ) : null}

        <div ref={bottomAnchorRef} />
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={MODE_CONFIG[mode].placeholder}
          rows={4}
        />
        <button disabled={isSending || isLoadingConversation} type="submit">
          {isSending ? "Fetching..." : "Send"}
        </button>
      </form>
    </section>
  );
}
