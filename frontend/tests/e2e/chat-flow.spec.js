import { expect, test } from "@playwright/test";

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
