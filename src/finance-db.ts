import { db } from "./db";
import { financeSchema, type FinanceTransaction } from "./finance";

export async function saveFinance(
  input: Omit<FinanceTransaction, "id" | "updatedAt">,
  existing?: FinanceTransaction,
) {
  return db.transaction("rw", db.finances, async () => {
    const current = existing ? await db.finances.get(existing.id) : undefined;
    if (existing && (!current || current.updatedAt !== existing.updatedAt))
      throw new Error(
        "This transaction changed in another tab. Reopen it before saving.",
      );
    const row = financeSchema.parse({
      ...input,
      id: existing?.id ?? crypto.randomUUID(),
      updatedAt: new Date(
        Math.max(Date.now(), current ? Date.parse(current.updatedAt) + 1 : 0),
      ).toISOString(),
    });
    await db.finances.put(row);
    return row;
  });
}
export async function deleteFinance(row: FinanceTransaction) {
  return db.transaction("rw", db.finances, async () => {
    const current = await db.finances.get(row.id);
    if (!current || current.updatedAt !== row.updatedAt)
      throw new Error("This transaction changed. Reopen it before deleting.");
    await db.finances.delete(row.id);
  });
}
export async function undoDeleteFinance(row: FinanceTransaction) {
  return db.transaction("rw", db.finances, async () => {
    if (await db.finances.get(row.id))
      throw new Error("This transaction already exists. Reload to review it.");
    await db.finances.add(row);
  });
}
