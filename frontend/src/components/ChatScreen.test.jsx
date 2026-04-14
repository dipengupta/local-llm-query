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

    const { user } = renderWithUser(<ChatScreen mode="general" onBack={() => {}} />);

    await user.type(screen.getByPlaceholderText("Ask anything you want to explore locally."), "Hello from component test");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe("/api/chat/general/");
    expect(JSON.parse(request.body)).toEqual({
      messages: [{ role: "user", content: "Hello from component test" }],
    });
    expect(await screen.findByRole("button", { name: "Sending..." })).toBeDisabled();

    pendingText.resolve(JSON.stringify({ answer: "Assistant reply from test mode" }));
    pendingResponse.resolve({ answer: "Assistant reply from test mode" });

    expect(await screen.findByText("Assistant reply from test mode")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).toBeEnabled());
  });

  test("submits the query payload and renders SQL details", async () => {
    mockJsonResponse({
      answer: "Deterministic query answer for: Count all records",
      sql: "SELECT :question AS question, char_length(:question) AS length",
      rows: [{ question: "Count all records", length: 17 }],
    });

    const { user } = renderWithUser(<ChatScreen mode="query" onBack={() => {}} />);

    await user.type(screen.getByPlaceholderText("Ask a question about the imported Postgres data."), "Count all records");
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

    const { user } = renderWithUser(<ChatScreen mode="general" onBack={() => {}} />);

    await user.type(screen.getByPlaceholderText("Ask anything you want to explore locally."), "Hello");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText("Backend exploded")).toBeInTheDocument();
  });

  test("ignores empty submissions", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { user } = renderWithUser(<ChatScreen mode="general" onBack={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
