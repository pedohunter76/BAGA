import { beforeEach, expect, it } from "vitest";
import { db, eraseData, savePreferences } from "./db";
import { defaults } from "./domain";
import { discardDraft, loadDraft, saveDraft } from "./onboarding";
beforeEach(eraseData);
it("resumes validated setup without storing completed consent or a profile", async () => {
  await saveDraft({
    version: 1,
    step: 1,
    form: { ...defaults, name: "Sam", adult: true },
  });
  expect((await loadDraft())?.form.name).toBe("Sam");
  expect((await loadDraft())?.form.adult).toBe(false);
  expect(await db.preferences.get("local")).toBeUndefined();
  await savePreferences({ ...defaults, adult: true, onboarded: true });
  expect(await loadDraft()).toBeUndefined();
});
it("discards drafts and clears all local-only notification state", async () => {
  await saveDraft({ version: 1, step: 0, form: defaults });
  await discardDraft();
  expect(await loadDraft()).toBeUndefined();
  await saveDraft({ version: 1, step: 2, form: defaults });
  await eraseData();
  expect(await db.deviceState.count()).toBe(0);
});
it("ignores corrupt drafts without deleting existing diary data", async () => {
  await db.deviceState.put({ id: "onboarding", data: { step: 9 } });
  expect(await loadDraft()).toBeUndefined();
});
