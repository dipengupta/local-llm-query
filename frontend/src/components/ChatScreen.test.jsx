import { screen, waitFor } from "@testing-library/react";
import ChatScreen from "./ChatScreen";
import { deferred, mockJsonError, mockJsonResponse, renderWithUser } from "../test/test-utils";

describe("ChatScreen", () => {
  test("submits the general chat payload, shows loading, and renders the response", async () => {
    const pendingResponse = deferred();
    const pendingText = deferred();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockReturnValue(pendingResponse.promise),
      text: vi.fn().mockReturnValue(pendingText.promise),
    }));

    const { user } = renderWithUser(<ChatScreen mode="general" onBack={() => {}} resumeLatest={false} />);

    await user.type(screen.getByPlaceholderText("Ask anything you want to explore locally."), "Hello from component test");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/chat/general/");
    expect(JSON.parse(request.body)).toEqual({
      question: "Hello from component test",
    });
    expect(await screen.findByRole("button", { name: "Fetching..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Fetching result...");

    pendingText.resolve(JSON.stringify({ answer: "Assistant reply from test mode", conversation_id: 11 }));
    pendingResponse.resolve({ answer: "Assistant reply from test mode", conversation_id: 11 });

    expect(await screen.findByText("Assistant reply from test mode")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  });

  test("submits the query payload and renders SQL details", async () => {
    mockJsonResponse({
      answer: "Deterministic query answer for: Count all records",
      conversation_id: 22,
      sql: "SELECT :question AS question, char_length(:question) AS length",
      rows: [{ question: "Count all records", length: 17 }],
    });

    const { user } = renderWithUser(<ChatScreen mode="query" onBack={() => {}} resumeLatest={false} />);

    await user.type(screen.getByPlaceholderText("Ask a question about Social Committee Teams."), "Count all records");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/chat/query/");
    expect(JSON.parse(request.body)).toEqual({ question: "Count all records" });
    expect(await screen.findByText("Deterministic query answer for: Count all records")).toBeInTheDocument();
    expect(screen.getByText("SELECT :question AS question, char_length(:question) AS length")).toBeInTheDocument();
    expect(screen.getByText("Rows (1)")).toBeInTheDocument();
  });

  test("shows backend errors", async () => {
    mockJsonError("Backend exploded");

    const { user } = renderWithUser(<ChatScreen mode="general" onBack={() => {}} resumeLatest={false} />);

    await user.type(screen.getByPlaceholderText("Ask anything you want to explore locally."), "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Backend exploded")).toBeInTheDocument();
  });

  test("ignores empty submissions", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { user } = renderWithUser(<ChatScreen mode="general" onBack={() => {}} resumeLatest={false} />);

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("loads a saved conversation by id", async () => {
    mockJsonResponse({
      id: 99,
      mode: "general",
      title: "Saved conversation",
      turns: [
        {
          id: 1,
          question: "Saved question",
          answer: "Saved answer",
          raw_sql: "",
          sql: "",
          rows: [],
          created_at: "2026-04-15T12:00:00Z",
        },
      ],
    });

    renderWithUser(<ChatScreen mode="general" onBack={() => {}} initialConversationId={99} resumeLatest={false} />);

    expect(await screen.findByText("Saved question")).toBeInTheDocument();
    expect(screen.getByText("Saved answer")).toBeInTheDocument();
  });
});
