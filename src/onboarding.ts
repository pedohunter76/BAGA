import { z } from "zod";
import { preferencesSchema } from "./domain";
import { db } from "./db";
const schema = z.object({
  version: z.literal(1),
  step: z.number().int().min(0).max(2),
  form: preferencesSchema,
});
export type OnboardingDraft = z.infer<typeof schema>;
export async function loadDraft() {
  const row = await db.deviceState.get("onboarding");
  const result = schema.safeParse(row?.data);
  return result.success ? result.data : undefined;
}
export async function saveDraft(draft: OnboardingDraft) {
  const valid = schema.parse(draft);
  await db.deviceState.put({
    id: "onboarding",
    data: { ...valid, form: { ...valid.form, adult: false, onboarded: false } },
  });
}
export async function discardDraft() {
  await db.deviceState.delete("onboarding");
}
