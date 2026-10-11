import { z } from "zod";
import { logInputSchema, measurementSchema, preferencesSchema } from "./domain";
import type { CloudKind, Payload } from "./sync-types";

const id = z.string().min(1).max(120);
const date = z.iso.date();
export const recordSchemas = {
  logs: logInputSchema.extend({
    id,
    revision: z.number().int().min(1),
    updatedAt: z.iso.datetime(),
    deletedAt: z.iso.datetime().nullable(),
  }),
  preferences: preferencesSchema,
  checkins: z.object({
    date,
    completedAt: z.iso.datetime(),
    confirmedCount: z.number().int().min(0).max(10000),
  }),
  measurements: measurementSchema.extend({ id }),
  variants: z.object({
    id,
    brand: z.string().trim().min(1).max(80),
    name: z.string().max(80),
    custom: z.boolean().optional(),
  }),
  cravings: z.object({
    id,
    at: z.iso.datetime(),
    intensity: z.number().int().min(1).max(5),
    trigger: z.string().max(60),
    notes: z.string().max(1000),
    coping: z.string().max(100).optional(),
    outcome: z.enum(["passed", "smoked", "ongoing"]).optional(),
  }),
};
export function validatePayload(
  kind: CloudKind,
  recordId: string,
  payload: Payload,
): Payload {
  if (payload === null) return null;
  const valid = recordSchemas[kind].parse(payload) as Record<string, unknown>;
  const actual = kind === "checkins" ? valid.date : valid.id;
  if (actual !== recordId)
    throw new Error("The record identifier does not match its content.");
  return valid;
}
// Stable comparison avoids treating JSON key order as a user edit.
export function snapshot(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object")
      return Object.fromEntries(
        Object.entries(item)
          .filter(([, value]) => value !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => [key, normalize(value)]),
      );
    return item;
  };
  return JSON.stringify(normalize(value));
}
