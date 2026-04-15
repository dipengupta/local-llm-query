import { useState } from "react";
import { postJson } from "../lib/api";

const MODE_CONFIG = {
  general: {
    label: "General",
    endpoint: "/api/chat/general/",
    placeholder: "Ask anything you want to explore locally.",
    submitShape(input, messages) {
      const apiMessages = messages
        .filter((message) => message.role !== "meta")
        .map(({ role, content }) => ({ role, content }));
      return { messages: [...apiMessages, { role: "user", content: input }] };
    },
    normalizeResponse(data) {
      return {
        role: "assistant",
        content: data.answer,
      };
    },
  },
  query: {
    label: "Query Agent",
    endpoint: "/api/chat/query/",
    placeholder: "Ask a question about Social Committee Teams.",
    submitShape(input) {
      return { question: input };
    },
    normalizeResponse(data) {
      return {
        role: "assistant",
        content: data.answer,
        rawSql: data.raw_sql,
        sql: data.sql,
        rows: data.rows,
      };
    },
  },
};

function Message({ message, mode }) {
  return (
    <article className={`message message-${message.role}`}>
      <div className="message-meta">{message.role === "user" ? "You" : MODE_CONFIG[mode].label}</div>
      <p>{message.content}</p>
      {message.rawSql && message.rawSql !== message.sql ? (
        <div className="query-details">
          <div className="query-label">Raw SQL</div>
          <pre>{message.rawSql}</pre>
        </div>
      ) : null}
      {message.sql ? (
        <div className="query-details">
          <div className="query-label">Executed SQL</div>
          <pre>{message.sql}</pre>
          <details>
            <summary>Rows ({message.rows?.length ?? 0})</summary>
            <pre>{JSON.stringify(message.rows, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </article>
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

export default function ChatScreen({ mode, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) {
      return;
    }

    const userMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setError("");
    setIsSending(true);

    try {
      const config = MODE_CONFIG[mode];
      const payload = config.submitShape(trimmed, messages);
      const data = await postJson(config.endpoint, payload);
      setMessages([...nextMessages, config.normalizeResponse(data)]);
    } catch (requestError) {
      if (mode === "query" && requestError.data?.sql) {
        setMessages([
          ...nextMessages,
          {
            role: "assistant",
            content: requestError.message,
            rawSql: requestError.data.sql,
            sql: requestError.data.sql,
            rows: [],
          },
        ]);
      } else {
        setError(requestError.message);
      }
    } finally {
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
          <h2>{mode === "general" ? "Local model chat" : "Database-grounded answers only"}</h2>
        </div>
      </header>

      <div className="message-list">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>{MODE_CONFIG[mode].placeholder}</p>
          </div>
        ) : (
          messages.map((message, index) => <Message key={`${message.role}-${index}`} message={message} mode={mode} />)
        )}
        {isSending ? <LoadingMessage mode={mode} /> : null}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <form className="composer" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={MODE_CONFIG[mode].placeholder}
          rows={4}
        />
        <button disabled={isSending} type="submit">
          {isSending ? "Fetching..." : "Send"}
        </button>
      </form>
    </section>
  );
}
