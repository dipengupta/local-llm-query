import { expect, test } from "@playwright/test";

const assistantResponseTimeout = Number(process.env.PLAYWRIGHT_CHAT_RESPONSE_TIMEOUT_MS || 180000);

test("general mode sends a message and renders the backend response", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /General/i }).click();
  await page.getByPlaceholder("Ask anything you want to explore locally.").fill("Hello from Playwright");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Hello from Playwright", { exact: true })).toBeVisible();
  await expect(page.getByText("Test reply: Hello from Playwright")).toBeVisible();
});

test("query mode renders answer, sql, and row details from the backend", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Query Agent/i }).click();
  await page.getByPlaceholder("Ask a question about Social Committee Teams.").fill("Count all records");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Deterministic query answer for: Count all records")).toBeVisible();
  await expect(page.getByText("SELECT :question AS question, char_length(:question) AS length")).toBeVisible();
  await expect(page.getByText("Rows (1)")).toBeVisible();
});

test("backend errors are shown to the user", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Query Agent/i }).click();
  await page.getByPlaceholder("Ask a question about Social Committee Teams.").fill("trigger query error");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("Playwright forced query error.")).toBeVisible();
});

test("history dashboard updates live when a new chat turn is saved from another tab", async ({ browser }) => {
  test.setTimeout(Math.max(assistantResponseTimeout + 30000, 60000));

  const context = await browser.newContext();
  const dashboardPage = await context.newPage();
  const chatPage = await context.newPage();
  const question = `What is a random dashboard sync check ${Date.now()}?`;
  let dashboardTurnFetchCount = 0;

  dashboardPage.on("request", (request) => {
    const requestUrl = new URL(request.url());
    if (request.method() === "GET" && requestUrl.pathname === "/api/chat/turns/") {
      dashboardTurnFetchCount += 1;
    }
  });

  await dashboardPage.bringToFront();
  await dashboardPage.goto("/#/history");
  await expect(dashboardPage.getByRole("heading", { name: "Conversation dashboard" })).toBeVisible();
  await expect(dashboardPage.getByText("Loading saved conversations...")).not.toBeVisible();
  const initialTurnCount = await dashboardPage.locator("tbody .history-turn-row").count();
  const initialFetchCount = dashboardTurnFetchCount;

  await chatPage.bringToFront();
  await chatPage.goto("/#/chat/general/new");
  const composer = chatPage.getByPlaceholder("Ask anything you want to explore locally.");
  await expect(composer).toBeVisible();
  await composer.fill(question);
  await expect(composer).toHaveValue(question);
  const chatResponsePromise = chatPage.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/api/chat/general/" &&
      response.status() === 200,
    { timeout: assistantResponseTimeout },
  );
  await chatPage.getByRole("button", { name: "Send" }).click();
  await expect(chatPage.getByRole("button", { name: "Fetching..." })).toBeDisabled();
  const chatResponse = await chatResponsePromise;
  const chatPayload = await chatResponse.json();
  const answerText = chatPayload.answer?.trim();
  expect(answerText).toBeTruthy();

  await expect(chatPage.getByText(question, { exact: true })).toBeVisible();
  await expect(chatPage.getByText(answerText)).toBeVisible({ timeout: assistantResponseTimeout });
  await expect(chatPage.getByRole("button", { name: "Send" })).toBeEnabled();

  await dashboardPage.bringToFront();
  await expect
    .poll(async () => dashboardPage.locator("tbody .history-turn-row").count(), {
      timeout: assistantResponseTimeout,
    })
    .toBe(initialTurnCount + 1);
  await expect(dashboardPage.getByText(question, { exact: true })).toBeVisible();
  await expect(dashboardPage.getByText(answerText)).toBeVisible({ timeout: assistantResponseTimeout });
  await expect.poll(() => dashboardTurnFetchCount).toBe(initialFetchCount);

  await context.close();
});
