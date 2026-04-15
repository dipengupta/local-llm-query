import { afterEach, beforeEach, vi } from "vitest";
import { act, screen } from "@testing-library/react";
import { StrictMode } from "react";
import HistoryDashboard from "./HistoryDashboard";
import { mockJsonResponse, renderWithUser } from "../test/test-utils";

class MockEventSource {
  static instances = [];

  constructor(url) {
    this.url = url;
    this.listeners = new Map();
    this.onopen = null;
    this.onerror = null;
    this.close = vi.fn();
    MockEventSource.instances.push(this);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  emit(type, data) {
    this.listeners.get(type)?.({ data: JSON.stringify(data) });
  }
}

describe("HistoryDashboard", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
  });

  afterEach(() => {
    MockEventSource.instances = [];
  });

  test("renders saved turns as collapsible rows without a session column", async () => {
    mockJsonResponse([
      {
        id: 7,
        conversation_id: 3,
        mode: "general",
        title: "Long conversation",
        question: "This is the complete question shown directly in the table.",
        answer: "This is the complete answer shown directly in the table as well.",
        raw_sql: "",
        sql: "",
        rows: [],
        created_at: "2026-04-15T13:00:00Z",
        conversation_updated_at: "2026-04-15T13:10:00Z",
        turn_count: 3,
      },
    ]);

    const { user } = renderWithUser(
      <HistoryDashboard
        onBack={() => {}}
        buildConversationHref={(conversation) => `#/chat/${conversation.mode}/conversation/${conversation.id}`}
        buildNewChatHref={(mode) => `#/chat/${mode}/new`}
      />,
    );

    expect(await screen.findByText("General")).toBeInTheDocument();
    expect(screen.queryByText("Session")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "#/chat/general/conversation/3");

    await user.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    expect(screen.getAllByText("This is the complete question shown directly in the table.")).toHaveLength(2);
    expect(screen.getAllByText("This is the complete answer shown directly in the table as well.")).toHaveLength(2);
  });

  test("merges live turn events without duplicating rows during snapshot refreshes", async () => {
    const initialTurn = {
      id: 7,
      conversation_id: 3,
      mode: "general",
      title: "Long conversation",
      question: "Initial question",
      answer: "Initial answer",
      raw_sql: "",
      sql: "",
      rows: [],
      created_at: "2026-04-15T13:00:00Z",
      conversation_updated_at: "2026-04-15T13:10:00Z",
      turn_count: 1,
    };
    const liveTurn = {
      id: 8,
      conversation_id: 4,
      mode: "query",
      title: "Fresh data",
      question: "What changed?",
      answer: "A new turn arrived.",
      raw_sql: "",
      sql: "",
      rows: [],
      created_at: "2026-04-15T13:12:00Z",
      conversation_updated_at: "2026-04-15T13:12:00Z",
      turn_count: 1,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify([initialTurn])),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify([liveTurn, initialTurn])),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWithUser(
      <HistoryDashboard
        onBack={() => {}}
        buildConversationHref={(conversation) => `#/chat/${conversation.mode}/conversation/${conversation.id}`}
        buildNewChatHref={(mode) => `#/chat/${mode}/new`}
      />,
    );

    expect(await screen.findByText("Initial question")).toBeInTheDocument();

    const eventSource = MockEventSource.instances[0];
    await act(async () => {
      eventSource.emit("turn", liveTurn);
    });
    expect(await screen.findByText("What changed?")).toBeInTheDocument();

    await act(async () => {
      eventSource.onerror?.();
    });

    expect(await screen.findByText("Initial answer")).toBeInTheDocument();
    expect(screen.getAllByText("What changed?")).toHaveLength(1);
    expect(screen.getAllByText("Initial question")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("loads history correctly when mounted in strict mode", async () => {
    mockJsonResponse([
      {
        id: 12,
        conversation_id: 6,
        mode: "general",
        title: "Strict mode conversation",
        question: "Does this render in dev?",
        answer: "Yes, the dashboard row is visible.",
        raw_sql: "",
        sql: "",
        rows: [],
        created_at: "2026-04-15T14:00:00Z",
        conversation_updated_at: "2026-04-15T14:00:00Z",
        turn_count: 1,
      },
    ]);

    renderWithUser(
      <StrictMode>
        <HistoryDashboard
          onBack={() => {}}
          buildConversationHref={(conversation) => `#/chat/${conversation.mode}/conversation/${conversation.id}`}
          buildNewChatHref={(mode) => `#/chat/${mode}/new`}
        />
      </StrictMode>,
    );

    expect(await screen.findByText("Does this render in dev?")).toBeInTheDocument();
    expect(screen.queryByText("Loading saved conversations...")).not.toBeInTheDocument();
  });
});
