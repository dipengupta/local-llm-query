import { screen } from "@testing-library/react";
import App from "./App";
import { renderWithUser } from "./test/test-utils";

describe("App", () => {
  test("renders the landing screen with both chat modes", () => {
    renderWithUser(<App />);

    expect(screen.getByRole("heading", { name: "Choose how you want to use the model." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /General/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Query Agent/i })).toBeInTheDocument();
  });

  test("lets the user enter a mode and return back home", async () => {
    const { user } = renderWithUser(<App />);

    await user.click(screen.getByRole("button", { name: /General/i }));
    expect(screen.getByRole("heading", { name: "Local model chat" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Choose how you want to use the model." })).toBeInTheDocument();
  });
});
