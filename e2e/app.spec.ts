import { createServer } from "node:http";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page: Page, url = "/") {
  await page.goto(url);
  await page
    .getByRole("button", { name: /Create my profile|Resume my profile/ })
    .click();
  const dialog = page.locator(".profile-page");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByLabel("What should we call you?").fill("Alex");
  await dialog.getByLabel("Price (PHP)").fill("12");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Start my journey" }).click();
  await expect(
    page.getByRole("heading", { name: "One day at a time, Alex." }),
  ).toBeVisible();
}

test("private onboarding, quick log, undo, and durable offline reload", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.getByTestId("today-count")).toContainText("0");
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByTestId("today-count")).toContainText("1");
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("2");
  await page.reload();
  await expect(page.getByTestId("today-count")).toContainText("2");
  await expect(page.getByText("Offline · saved locally")).toBeVisible();
  await page.close();
  const restored = await context.newPage();
  await restored.goto("/");
  await expect(restored.getByTestId("today-count")).toContainText("2");
  expect(errors).toEqual([]);
});

test("record edits and price snapshots remain correct", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "Log with details" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantity", { exact: true })
    .fill("2");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save record" })
    .click();
  await expect(page.getByTestId("today-count")).toContainText("2");
  await page.goto("/?view=settings");
  await page.getByLabel("Current price (PHP)").fill("24");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("settings are saved");
  await page.goto("/");
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("3");
  await expect(
    page.locator(".stat-card").filter({ hasText: "Today’s spending" }),
  ).toContainText("₱48.00");
  await page.goto("/?view=log");
  await page.getByRole("button", { name: /^Edit 2 Marlboro/ }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantity", { exact: true })
    .fill("1");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.locator(".history-summary")).toContainText("₱36.00");
  await page
    .getByRole("button", { name: /^Edit 1 Marlboro/ })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Delete record", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(page.locator(".history-list .log-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".history-list .log-row")).toHaveCount(2);
});

test("smoke-free check-ins recalculate after a later cigarette", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Smoke-free check-in" }).click();
  await page.getByRole("button", { name: "Confirm check-in" }).click();
  const smokeFree = page
    .locator(".stat-card")
    .filter({ hasText: "Smoke-free streak" });
  await expect(smokeFree).toContainText("1");
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(smokeFree).toContainText("0");
});

test("Lung Studio stores real entries separately from illustrative settings", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/?view=lungs");
  await page.getByRole("tab", { name: "My measurements" }).click();
  await expect(page.getByText("No measurements yet.")).toBeVisible();
  await page.getByLabel("Entered value (L)").fill("4.3");
  await page.getByRole("button", { name: "Save measurement" }).click();
  await expect(page.locator(".capacity-number")).toContainText("4.3");
  await expect(page.locator(".capacity-comparison")).toContainText("86.0%");
  await page.getByRole("tab", { name: "Educational model" }).click();
  await page.getByRole("slider").fill("80");
  await page.getByRole("button", { name: "Save studio preferences" }).click();
  await page.getByRole("tab", { name: "My measurements" }).click();
  await expect(page.locator(".capacity-number")).toContainText("4.3");
  await expect(page.getByText(/not a clinical interpretation/)).toBeVisible();
});

test("all screens work at mobile widths without horizontal overflow", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const view of [
    "home",
    "log",
    "lungs",
    "insights",
    "goals",
    "calendar",
    "library",
    "settings",
  ]) {
    await page.goto(view === "home" ? "/" : `/?view=${view}`);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("exports and clears all local records after explicit confirmation", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1");
  await page.goto("/?view=settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await download).suggestedFilename()).toMatch(/baga-diary-.*\.json/);
  await page.getByRole("button", { name: "Clear local data" }).click();
  await page.getByLabel("Type DELETE to confirm").fill("DELETE");
  await page
    .getByRole("button", { name: "Permanently delete local data" })
    .click();
  await expect(
    page.getByRole("button", { name: "Create my profile" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore BAGA first" }).click();
  await expect(page.getByTestId("today-count")).toContainText("0");
});

test("storage failures never report a successful save or discard an entry", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Log with details" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantity", { exact: true })
    .fill("3");
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Storage quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Could not save on this device",
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByLabel("Quantity", { exact: true }),
  ).toHaveValue("3");
  await expect(page.getByTestId("today-count")).toContainText("0");
});

test("core screens and onboarding pass automated WCAG checks", async ({
  page,
}) => {
  for (const view of ["home", "lungs", "settings", "calendar"]) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator("h1")).toBeVisible();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Create my profile" }).click();
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("calendar backdating and narrow 320px layout work", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 320, height: 750 });
  await page.goto("/?view=calendar");
  await page.getByRole("button", { name: "Previous month" }).click();
  const target = page.locator(".calendar-day").first();
  const date = (await target.getAttribute("aria-label"))!.slice(0, 10);
  await target.click();
  await page.getByRole("button", { name: "Add a backdated record" }).click();
  const dateInput = page.getByRole("dialog").getByLabel("Date & time");
  await expect(dateInput).toHaveValue(`${date}T12:00`);
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.locator(".calendar-day-total")).toContainText("1");
  for (const view of ["home", "lungs", "insights", "settings"]) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator("h1")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("changing timezone regroups historical timestamps accurately", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Log with details" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Date & time")
    .fill("2025-01-02T01:00");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/?view=log");
  await expect(page.locator(".history-list")).toContainText("2025-01-02");
  await page.goto("/?view=settings");
  await page
    .getByLabel("Timezone", { exact: false })
    .selectOption("America/Los_Angeles");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("settings are saved");
  await page.goto("/?view=log");
  await expect(page.locator(".history-list")).toContainText("2025-01-01");
});

test("shows recovery instructions when the application bundle cannot load", async ({
  page,
}) => {
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "BAGA", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Reload BAGA" })).toBeVisible();
  await expect(page.locator("#startup-help")).toBeVisible({ timeout: 10000 });
});

test("invalid saved settings cannot blank the dashboard or erase records", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("baga-private-v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction("preferences", "readwrite");
          const table = transaction.objectStore("preferences");
          const get = table.get("local");
          get.onsuccess = () =>
            table.put({ ...get.result, timezone: "invalid-zone" });
          transaction.oncomplete = () => {
            database.close();
            resolve();
          };
          transaction.onerror = () => {
            database.close();
            reject(transaction.error);
          };
        };
      }),
  );
  await page.reload();
  await expect(page.getByRole("alert")).toContainText(
    "Your saved settings could not be loaded",
  );
  await page.getByRole("button", { name: "Explore BAGA first" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1");
});

test("the website opens inside a cross-origin preview frame", async ({
  page,
}) => {
  const server = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(
      '<!doctype html><html><head><title>Preview host</title></head><body style="margin:0"><iframe title="BAGA preview" src="http://127.0.0.1:4173/" style="width:100%;height:100vh;border:0"></iframe></body></html>',
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Preview harness did not start");
    await page.goto(`http://127.0.0.1:${address.port}/preview`);
    await expect(
      page
        .frameLocator("iframe")
        .getByRole("heading", { name: /A fresh start/ }),
    ).toBeVisible();
    await page
      .frameLocator("iframe")
      .getByRole("button", { name: "Create my profile" })
      .click();
    await expect(
      page.frameLocator("iframe").locator(".profile-page"),
    ).toBeVisible();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("craving journal works offline without adding cigarette records", async ({
  page,
  context,
}) => {
  await setup(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.goto("/?view=cravings");
  await page.getByRole("button", { name: "Log a craving" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("What helped? (optional)").fill("A short walk");
  await dialog.getByLabel("Outcome").selectOption("passed");
  await dialog.getByLabel("Notes (optional)").fill("Coffee break");
  await dialog.getByRole("button", { name: "Save craving" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("What helped: A short walk")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Coffee break", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Edit craving" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Notes (optional)")
    .fill("Updated context");
  await page.getByRole("button", { name: "Save craving" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Updated context", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete craving" }).click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByText("Updated context", { exact: true }),
  ).toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("today-count")).toContainText("0");
});

test("validates, reviews, and restores an exported backup", async ({
  page,
}) => {
  await setup(page);
  await page.getByRole("button", { name: "Log cigarette +1" }).click();
  await expect(page.getByTestId("today-count")).toContainText("1");
  await page.goto("/?view=settings");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByLabel("Restore JSON backup").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(page.getByRole("alert")).toContainText("not a valid BAGA");
  await page.getByLabel("Restore JSON backup").setInputFiles(path!);
  await expect(page.getByRole("dialog")).toContainText("1 cigarette records");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/");
  await expect(page.getByTestId("today-count")).toContainText("1");
});

test("phase-two screens remain accessible and fit a narrow viewport", async ({
  page,
}) => {
  await setup(page);
  for (const view of ["cravings", "account", "goals", "insights", "settings"]) {
    await page.goto(`/?view=${view}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations, `${view} accessibility`).toEqual([]);
    await page.setViewportSize({ width: 320, height: 800 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("welcome profile keeps drafts, requires consent, and returns users to their diary", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".welcome-page h1")).toContainText(
    "A fresh start.",
  );
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page.getByRole("button", { name: "Understand my habits" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("What should we call you?").fill("Sam");
  await expect(page.locator(".profile-initial")).toHaveText("S");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Understand my habits" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue("Sam");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start my journey" }).click();
  await expect(page.locator(".profile-page")).toBeVisible();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Start my journey" }).click();
  await expect(
    page.getByRole("heading", { name: "One day at a time, Sam." }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "One day at a time, Sam." }),
  ).toBeVisible();
  await expect(page.locator(".welcome-page")).toHaveCount(0);
});

test("small-screen profile and navigation stay comfortable and accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  const name = page.getByLabel("What should we call you?");
  expect(
    await name.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Cancel setup" }).click();
  await expect(page.locator(".welcome-page")).toBeVisible();
  await page.getByRole("button", { name: "Discard saved setup" }).click();
  await setup(page);
  const more = page.getByRole("button", { name: "More navigation" });
  await more.click();
  await expect(page.getByRole("dialog", { name: "Your space" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Craving journal" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Notice the urge." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/");
  await page.getByRole("button", { name: "Log with details" }).click();
  await page
    .getByRole("dialog")
    .getByLabel("Quantity", { exact: true })
    .fill("2");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Save record" })
    .click();
  await expect(page.getByTestId("today-count")).toContainText("2");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("profile drafts survive reload, require fresh consent, and can be discarded", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Create my profile" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("What should we call you?").fill("Returning draft");
  await page.getByLabel("Price (PHP)").fill("15");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string | undefined>((resolve, reject) => {
            const request = indexedDB.open("baga-private-v1");
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const database = request.result;
              const get = database
                .transaction("deviceState")
                .objectStore("deviceState")
                .get("onboarding");
              get.onsuccess = () => {
                resolve(get.result?.data?.form?.name);
                database.close();
              };
            };
          }),
      ),
    )
    .toBe("Returning draft");
  await page.reload();
  await page.getByRole("button", { name: "Resume my profile" }).click();
  await expect(page.getByLabel("What should we call you?")).toHaveValue(
    "Returning draft",
  );
  await expect(page.getByLabel("Price (PHP)")).toHaveValue("15");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("button", { name: "Cancel setup" }).click();
  await page.getByRole("button", { name: "Discard saved setup" }).click();
  await expect(
    page.getByRole("button", { name: "Create my profile" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Create my profile" }).click();
  await expect(page.locator(".profile-step")).toContainText("Step 1");
});

test("app notifications persist privately, open the right page, and recover from denied system alerts", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/?view=settings");
  await page
    .getByRole("switch", { name: "Enable app notifications", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Save notification preferences", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Notification preferences saved",
  );
  await page.getByRole("button", { name: "Send test notification" }).click();
  await page.getByRole("button", { name: /Open notifications/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Your notifications" }),
  ).toContainText("A moment for yourself");
  await page
    .getByRole("button", { name: "Open overview", exact: true })
    .click();
  await expect(page.getByTestId("today-count")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Open notifications/ }).click();
  await expect(page.locator(".notification-inbox li")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Mark all as read" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.goto("/?view=settings");
  await page.evaluate(() => {
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "denied",
        requestPermission: () => Promise.resolve("denied"),
      },
    });
  });
  await page
    .getByRole("button", { name: "Enable discreet system alerts" })
    .click();
  await expect(page.getByRole("status")).toContainText("weren’t permitted");
  await page.getByRole("button", { name: "Send test notification" }).click();
  await page.getByRole("button", { name: /Open notifications/ }).click();
  await expect(page.locator(".notification-inbox li")).toHaveCount(2);
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(result.violations).toEqual([]);
});

test("daily notifications deduplicate across reload and tabs and skip confirmed days", async ({
  page,
  context,
}) => {
  await setup(page);
  // Keep this behavioral test independent of the host clock, permission, or a push server.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("baga-private-v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction(
            ["preferences", "deviceState"],
            "readwrite",
          );
          const prefs = tx.objectStore("preferences");
          const get = prefs.get("local");
          get.onsuccess = () => prefs.put({ ...get.result, timezone: "UTC" });
          const time = new Date().toISOString().slice(11, 16);
          tx.objectStore("deviceState").put({
            id: "notifications",
            data: {
              enabled: true,
              daily: true,
              weekly: false,
              milestones: false,
              time,
              quietStart: "00:00",
              quietEnd: "00:00",
              system: false,
              baseline: [],
            },
          });
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await page.getByRole("button", { name: /Open notifications/ }).click();
  await expect(page.locator(".notification-inbox li")).toHaveCount(1);
  await page.getByRole("button", { name: "Close dialog" }).click();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("button", { name: /Open notifications/ }).click();
  await expect(second.locator(".notification-inbox li")).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: /Open notifications/ }).click();
  await expect(page.locator(".notification-inbox li")).toHaveCount(1);
  await second.close();
});

test("historical goals remain stable after changes and survive export and restore", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("baga-private-v1");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const tx = database.transaction(
            ["preferences", "checkins", "logs"],
            "readwrite",
          );
          const prefs = tx.objectStore("preferences");
          const get = prefs.get("local");
          get.onsuccess = () => {
            const now = new Date();
            const format = new Intl.DateTimeFormat("en-CA", {
              timeZone: get.result.timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });
            const parts = format.formatToParts(now);
            const part = (name: string) =>
              parts.find((p) => p.type === name)!.value;
            const today = `${part("year")}-${part("month")}-${part("day")}`;
            const yesterdayDate = new Date(`${today}T12:00:00Z`);
            yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
            const yesterday = yesterdayDate.toISOString().slice(0, 10);
            const goal = {
              ...get.result.goalHistory[0],
              effectiveDate: yesterday,
              dailyLimit: 10,
            };
            prefs.put({ ...get.result, goalHistory: [goal] });
            tx.objectStore("checkins").put({
              date: yesterday,
              completedAt: new Date().toISOString(),
              confirmedCount: 5,
            });
            // Midday UTC is the same calendar day in the default Manila timezone.
            const at = `${yesterday}T04:00:00Z`;
            tx.objectStore("logs").put({
              id: "historical",
              variantId: "marlboro-red",
              brand: "Marlboro",
              variant: "Red",
              quantity: 5,
              smokedAt: at,
              priceSnapshot: 12,
              trigger: "None",
              mood: "",
              location: "",
              notes: "",
              revision: 1,
              updatedAt: at,
              deletedAt: null,
            });
          };
          tx.oncomplete = () => {
            database.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.goto("/?view=goals");
  await expect(
    page.locator(".streak-card").filter({ hasText: "Within-limit streak" }),
  ).toContainText("1");
  await page.getByLabel("Daily cigarette limit").fill("2");
  await page.getByRole("button", { name: "Save my goal" }).click();
  await expect(page.getByRole("status")).toContainText("Your goal is saved");
  await expect(page.locator(".goal-history li")).toHaveCount(2);
  await expect(
    page.locator(".streak-card").filter({ hasText: "Within-limit streak" }),
  ).toContainText("1");
  await page.goto("/?view=settings");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const file = await downloaded;
  const path = await file.path();
  await page.getByLabel("Restore JSON backup").setInputFiles(path!);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore backup" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/?view=goals");
  await expect(page.locator(".goal-history li")).toHaveCount(2);
});

test("a waiting PWA update preserves open work and saved records", async ({
  page,
}) => {
  let revision = 1;
  const server = createServer(async (request, response) => {
    try {
      const path = request.url ?? "/";
      const upstream = await fetch(`http://127.0.0.1:4173${path}`);
      response.statusCode = upstream.status;
      response.setHeader(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/octet-stream",
      );
      response.setHeader("Cache-Control", "no-store");
      const bytes = Buffer.from(await upstream.arrayBuffer());
      response.end(
        path.startsWith("/sw.js")
          ? Buffer.concat([
              bytes,
              Buffer.from(`\n// test update ${revision}\n`),
            ])
          : bytes,
      );
    } catch {
      response.statusCode = 502;
      response.end("Preview unavailable");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Test host failed");
    const url = `http://127.0.0.1:${address.port}`;
    await setup(page, url);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await expect(page.getByTestId("today-count")).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    await page.getByRole("button", { name: "Log with details" }).click();
    await page
      .getByRole("dialog")
      .getByLabel("Quantity", { exact: true })
      .fill("3");
    revision = 2;
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      await registration!.update();
    });
    await expect(page.locator(".update-prompt")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update now", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("dialog").getByLabel("Quantity", { exact: true }),
    ).toHaveValue("3");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save record" })
      .click();
    await expect(page.getByTestId("today-count")).toContainText("3");
    await expect(
      page.getByRole("button", { name: "Update now", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Update now", exact: true }).click();
    await expect(page.getByTestId("today-count")).toContainText("3");
    await expect(page.locator(".update-prompt")).toHaveCount(0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
