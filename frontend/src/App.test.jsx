import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithUser } from "./test/test-utils";

describe("App", () => {
  test("renders the landing screen with both chat modes", () => {
    renderWithUser(<App />);

    expect(screen.getByRole("heading", { name: "Choose how you want to use the model." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Query Agent/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open history dashboard" })).toBeInTheDocument();
  });

  test("lets the user enter a mode and return back home", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue(JSON.stringify({ detail: "No saved conversation for this mode." })),
    }));

    const { user } = renderWithUser(<App />);

    await user.click(screen.getByRole("link", { name: /General/i }));
    expect(screen.getByRole("heading", { name: "Local model chat" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Choose how you want to use the model." })).toBeInTheDocument();
  });

  test("opens the history dashboard from the landing screen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue("[]"),
    }));

    const { user } = renderWithUser(<App />);

    await user.click(screen.getByRole("link", { name: "Open history dashboard" }));
    expect(screen.getByRole("heading", { name: "Conversation dashboard" })).toBeInTheDocument();
  });
});
