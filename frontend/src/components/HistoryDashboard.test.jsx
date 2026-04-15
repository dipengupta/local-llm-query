import { screen } from "@testing-library/react";
import HistoryDashboard from "./HistoryDashboard";
import { mockJsonResponse, renderWithUser } from "../test/test-utils";

describe("HistoryDashboard", () => {
  test("expands a row to show the full question and answer", async () => {
    mockJsonResponse([
      {
        id: 7,
        mode: "general",
        title: "Long conversation",
        latest_question: "This is a much longer question that should still be fully visible when expanded.",
        latest_answer: "This is the full answer content that should appear in the expanded row for inspection.",
        turn_count: 3,
        updated_at: "2026-04-15T13:00:00Z",
      },
    ]);

    const { user } = renderWithUser(
      <HistoryDashboard
        onBack={() => {}}
        buildConversationHref={(conversation) => `#/chat/${conversation.mode}/conversation/${conversation.id}`}
        buildNewChatHref={(mode) => `#/chat/${mode}/new`}
      />,
    );

    expect(await screen.findByText("Long conversation")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show" }));

    expect(screen.getByText("Full question")).toBeInTheDocument();
    expect(
      screen.getAllByText("This is a much longer question that should still be fully visible when expanded."),
    ).toHaveLength(2);
    expect(
      screen.getAllByText("This is the full answer content that should appear in the expanded row for inspection."),
    ).toHaveLength(2);
  });
});
