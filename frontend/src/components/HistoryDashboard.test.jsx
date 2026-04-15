import { screen } from "@testing-library/react";
import HistoryDashboard from "./HistoryDashboard";
import { mockJsonResponse, renderWithUser } from "../test/test-utils";

describe("HistoryDashboard", () => {
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
});
