import { test, expect, type BrowserContext, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const user = "10000000-0000-4000-8000-000000000001";
class CloudFixture {
  rows = new Map<string, any>();
  receipts = new Map<string, any>();
  writes = 0;
  loseResponse = false;
  async install(context: BrowserContext) {
    await context.route("https://baga-test.supabase.co/**", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Content-Type": "application/json",
      };
      const fulfill = (body: unknown, status = 200) =>
        route.fulfill({ status, headers, body: JSON.stringify(body) });
      if (request.method() === "OPTIONS") return fulfill(null, 204);
      if (url.pathname === "/auth/v1/token")
        return fulfill({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          expires_in: 3600,
          user: { id: user, email: "alex@example.test" },
        });
      if (url.pathname === "/auth/v1/logout") return fulfill({});
      if (url.pathname === "/rest/v1/baga_records")
        return fulfill(
          [...this.rows.values()].sort((a, b) => a.key.localeCompare(b.key)),
        );
      if (url.pathname === "/rest/v1/rpc/baga_sync_batch") {
        this.writes++;
        const results = request.postDataJSON().p_operations.map((op: any) => {
          if (this.receipts.has(op.operation_id))
            return this.receipts.get(op.operation_id);
          const existing = this.rows.get(op.key);
          const conflict = (existing?.revision || 0) !== op.expected_revision;
          const row = conflict
            ? existing
            : {
                key: op.key,
                kind: op.kind,
                record_id: op.record_id,
                payload: op.payload,
                revision: op.expected_revision + 1,
              };
          const result = {
            operation_id: op.operation_id,
            status: conflict ? "conflict" : "applied",
            row: structuredClone(row),
          };
          this.rows.set(op.key, row);
          this.receipts.set(op.operation_id, result);
          return result;
        });
        if (this.loseResponse) {
          this.loseResponse = false;
          return route.abort("failed");
        }
        return fulfill(results);
      }
      if (url.pathname === "/rest/v1/rpc/baga_delete_account") {
        this.rows.clear();
        this.receipts.clear();
        return fulfill(null);
      }
      return fulfill({ error: "unexpected_request" }, 500);
    });
  }
}
async function onboard(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Create my profile" }).click();
  const dialog = page.locator(".profile-page");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel("What should we call you?").fill("Alex");
  await dialog.getByLabel("Price (PHP)").fill("12");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Start my journey" }).click();
  await expect(dialog).not.toBeVisible();
}
async function signIn(page: Page) {
  await page.goto("/?view=account");
  await page.getByLabel("Email address").fill("alex@example.test");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as", { exact: false })).toBeVisible();
}
async function enable(page: Page) {
  await page
    .getByRole("checkbox", { name: "I agree to upload my diary" })
    .check();
  await page
    .getByRole("button", { name: "Enable cloud sync", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Cloud sync enabled", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.locator(".sync-summary").first().innerText())
    .not.toContain("Syncing");
}

test("sign-in never uploads data without explicit cloud consent", async ({
  page,
  context,
}) => {
  const fixture = new CloudFixture();
  await fixture.install(context);
  await onboard(page);
  await signIn(page);
  await expect(
    page.getByRole("button", { name: "Enable cloud sync", exact: true }),
  ).toBeDisabled();
  expect(fixture.writes).toBe(0);
  expect(fixture.rows.size).toBe(0);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("two device profiles share records and reconcile a new offline entry", async ({
  page,
  context,
  browser,
}) => {
  const fixture = new CloudFixture();
  await fixture.install(context);
  await onboard(page);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await signIn(page);
  await enable(page);
  await expect
    .poll(
      () =>
        [...fixture.rows.values()].filter((row) => row.kind === "logs").length,
    )
    .toBe(1);
  const other = await browser.newContext({ baseURL: "http://127.0.0.1:4175" });
  await fixture.install(other);
  const second = await other.newPage();
  try {
    await signIn(second);
    await enable(second);
    await second.goto("/");
    await expect(
      second.getByRole("heading", { name: "One day at a time, Alex." }),
    ).toBeVisible();
    await expect(second.getByTestId("today-count")).toContainText("1");
    await second.evaluate(() => navigator.serviceWorker.ready);
    await second.reload();
    await expect
      .poll(() =>
        second.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);
    await other.setOffline(true);
    await second.getByRole("button", { name: "Log cigarette +1" }).click();
    await expect(second.getByTestId("today-count")).toContainText("2");
    await second.reload();
    await expect(second.getByTestId("today-count")).toContainText("2");
    await other.setOffline(false);
    await second.goto("/?view=account");
    await second.getByRole("button", { name: "Sync now", exact: true }).click();
    await expect
      .poll(
        () =>
          [...fixture.rows.values()].filter((row) => row.kind === "logs")
            .length,
      )
      .toBe(2);
    await page.getByRole("button", { name: "Sync now", exact: true }).click();
    await page.goto("/");
    await expect(page.getByTestId("today-count")).toContainText("2");
  } finally {
    await other.close();
  }
});

test("an interrupted response preserves a retry and conflict review keeps both versions", async ({
  page,
  context,
}) => {
  const fixture = new CloudFixture();
  await fixture.install(context);
  await onboard(page);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await signIn(page);
  fixture.loseResponse = true;
  await enable(page);
  await expect(page.getByRole("alert")).toContainText("Sync could not finish");
  const count = fixture.receipts.size;
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(page.getByRole("alert")).not.toBeVisible();
  expect(fixture.receipts.size).toBe(count);
  const log = [...fixture.rows.values()].find((row) => row.kind === "logs");
  await page.goto("/?view=log");
  await page
    .getByRole("button", { name: /^Edit \d/ })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "+ Add a trigger, mood or note", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Notes (optional)")
    .fill("Device note");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save changes" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  fixture.rows.set(log.key, {
    ...log,
    revision: log.revision + 1,
    payload: { ...log.payload, notes: "Cloud note" },
  });
  await page.goto("/?view=account");
  await page.getByRole("button", { name: "Sync now", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Review versions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review versions" }).click();
  await expect(page.getByRole("dialog")).toContainText("Device note");
  await expect(page.getByRole("dialog")).toContainText("Cloud note");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Keep this device’s version" })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect
    .poll(() => fixture.rows.get(log.key).payload.notes)
    .toBe("Device note");
});
