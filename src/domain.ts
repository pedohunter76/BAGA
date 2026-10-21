import { z } from "zod";
import { goalHistorySchema, goalOnDate, type GoalVersion } from "./goal-schema";

export type View =
  | "home"
  | "log"
  | "lungs"
  | "insights"
  | "goals"
  | "calendar"
  | "library"
  | "budget"
  | "account"
  | "settings";
export type GoalMode = "reduce" | "quit" | "track";
export interface Preferences {
  id: "local";
  name: string;
  onboarded: boolean;
  adult: boolean;
  timezone: string;
  dailyLimit: number;
  goalHistory?: GoalVersion[];
  baseline: number;
  weeklyReduction: number;
  goalMode: GoalMode;
  quitAt: string;
  favoriteId: string;
  price: number;
  packSize: number;
  priceUnit: "stick" | "pack";
  animation: boolean;
  intensity: number;
  reminder: boolean;
  reminderTime: string;
  theme: "dark" | "light";
  showSpending: boolean;
  showLungs: boolean;
}
export interface Variant {
  id: string;
  brand: string;
  name: string;
  custom?: boolean;
}
export interface CigaretteLog {
  id: string;
  variantId: string;
  brand: string;
  variant: string;
  quantity: number;
  smokedAt: string;
  priceSnapshot: number;
  trigger: string;
  mood: string;
  location: string;
  notes: string;
  revision: number;
  updatedAt: string;
  deletedAt: string | null;
}
export interface Checkin {
  date: string;
  completedAt: string;
  confirmedCount: number;
}
export interface Measurement {
  id: string;
  type: "Volume" | "FVC" | "FEV1";
  value: number;
  reference: number;
  unit: "L";
  source: string;
  measuredAt: string;
}
export interface Craving {
  id: string;
  at: string;
  intensity: number;
  trigger: string;
  notes: string;
  coping?: string;
  outcome?: "passed" | "smoked" | "ongoing";
}

export const defaults: Preferences = {
  id: "local",
  name: "",
  onboarded: false,
  adult: false,
  timezone: "Asia/Manila",
  dailyLimit: 10,
  baseline: 20,
  weeklyReduction: 10,
  goalMode: "reduce",
  quitAt: "",
  favoriteId: "marlboro-red",
  price: 0,
  packSize: 20,
  priceUnit: "stick",
  animation: true,
  intensity: 30,
  reminder: false,
  reminderTime: "20:00",
  theme: "dark",
  showSpending: true,
  showLungs: true,
};
export const catalog: Variant[] = [
  ...["Red", "Gold", "Black", "Ice Blast"].map((name) => ({
    id: `marlboro-${name.toLowerCase().replaceAll(" ", "-")}`,
    brand: "Marlboro",
    name,
  })),
  ...["Red", "Blue"].map((name) => ({
    id: `fortune-${name.toLowerCase()}`,
    brand: "Fortune",
    name,
  })),
  ...["Red", "Blue"].map((name) => ({
    id: `winston-${name.toLowerCase()}`,
    brand: "Winston",
    name,
  })),
  ...["Mighty", "Camel", "Philip Morris", "Hope"].map((brand) => ({
    id: brand.toLowerCase().replaceAll(" ", "-"),
    brand,
    name: "Unspecified variant",
  })),
];
export const triggers = [
  "None",
  "After a meal",
  "Stress",
  "Coffee",
  "Socializing",
  "Boredom",
  "Other",
];
export const money = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(n);
export const perStick = (p: Preferences) =>
  p.priceUnit === "pack" ? p.price / p.packSize : p.price;
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
export function dayKey(input: string | Date, timezone: string) {
  let formatter = dayFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(new Date(input));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function shiftDay(key: string, amount: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function localDateTime(iso: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function fromLocalDateTime(value: string, timezone: string) {
  const target = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(target))
    throw new Error("Choose a valid date and time.");
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const rendered = Date.parse(
      `${localDateTime(new Date(guess).toISOString(), timezone)}:00Z`,
    );
    guess += target - rendered;
  }
  const iso = new Date(guess).toISOString();
  if (localDateTime(iso, timezone) !== value)
    throw new Error(
      "This local time does not exist in your timezone. Choose another time.",
    );
  return iso;
}
export const logInputSchema = z.object({
  variantId: z.string().min(1),
  brand: z.string().trim().min(1).max(80),
  variant: z.string().max(80),
  quantity: z.number().int().min(1).max(100),
  smokedAt: z.iso
    .datetime()
    .refine(
      (value) => Date.parse(value) <= Date.now() + 60_000,
      "Logs cannot be in the future.",
    ),
  priceSnapshot: z.number().finite().min(0).max(10000),
  trigger: z.string().max(60),
  mood: z.string().max(60),
  location: z.string().max(60),
  notes: z.string().max(1000),
});
export const measurementSchema = z.object({
  type: z.enum(["Volume", "FVC", "FEV1"]),
  value: z.number().finite().gt(0).max(10),
  reference: z.number().finite().gt(0).max(10),
  unit: z.literal("L"),
  source: z.string().trim().min(1).max(100),
  measuredAt: z.iso
    .datetime()
    .refine(
      (value) => Date.parse(value) <= Date.now(),
      "Measurement date cannot be in the future.",
    ),
});
export const preferencesSchema = z.object({
  id: z.literal("local"),
  goalHistory: goalHistorySchema.optional(),
  name: z.string().max(40),
  onboarded: z.boolean(),
  adult: z.boolean(),
  timezone: z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid IANA timezone."),
  dailyLimit: z.number().int().min(0).max(100),
  baseline: z.number().int().min(0).max(100),
  weeklyReduction: z.number().min(0).max(100),
  goalMode: z.enum(["reduce", "quit", "track"]),
  quitAt: z
    .string()
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Choose a valid quit date.",
    ),
  favoriteId: z.string().min(1),
  price: z.number().finite().min(0).max(10000),
  packSize: z.number().int().min(1).max(100),
  priceUnit: z.enum(["stick", "pack"]),
  animation: z.boolean(),
  intensity: z.number().min(0).max(100),
  reminder: z.boolean(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  theme: z.enum(["dark", "light"]),
  showSpending: z.boolean(),
  showLungs: z.boolean(),
});
export function activeLogs(logs: CigaretteLog[]) {
  return logs.filter((log) => !log.deletedAt);
}
export function dayTotals(
  logs: CigaretteLog[],
  date: string,
  timezone: string,
) {
  const records = activeLogs(logs).filter(
    (log) => dayKey(log.smokedAt, timezone) === date,
  );
  return {
    records,
    count: records.reduce((n, log) => n + log.quantity, 0),
    spent: records.reduce((n, log) => n + log.quantity * log.priceSnapshot, 0),
  };
}
export function streak(
  logs: CigaretteLog[],
  checkins: Checkin[],
  today: string,
  timezone: string,
  limit: number | GoalVersion[],
  kind: "smokeFree" | "withinLimit" | "logging",
) {
  const completed = new Set(checkins.map((c) => c.date));
  const grouped = groupDays(logs, timezone);
  const zones = new Map([[timezone, grouped]]);
  let date = completed.has(today) ? today : shiftDay(today, -1);
  let days = 0;
  while (completed.has(date)) {
    const goal = Array.isArray(limit) ? goalOnDate(limit, date) : undefined;
    const ceiling = Array.isArray(limit)
      ? goal?.goalMode === "track"
        ? undefined
        : goal?.dailyLimit
      : limit;
    if (goal && !zones.has(goal.timezone))
      zones.set(goal.timezone, groupDays(logs, goal.timezone));
    const count =
      (kind === "withinLimit" && goal
        ? zones.get(goal.timezone)!
        : grouped
      ).get(date)?.count || 0;
    if (
      (kind === "smokeFree" && count !== 0) ||
      (kind === "withinLimit" && (ceiling === undefined || count > ceiling))
    )
      break;
    days++;
    date = shiftDay(date, -1);
  }
  return days;
}
export function series(
  logs: CigaretteLog[],
  today: string,
  timezone: string,
  days: number,
) {
  const grouped = groupDays(logs, timezone);
  return Array.from({ length: days }, (_, i) => {
    const date = shiftDay(today, i - days + 1);
    return {
      date,
      ...(grouped.get(date) || { records: [], count: 0, spent: 0 }),
    };
  });
}
export function formatTime(iso: string, timezone: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function groupDays(logs: CigaretteLog[], timezone: string) {
  const grouped = new Map<
    string,
    { records: CigaretteLog[]; count: number; spent: number }
  >();
  for (const log of activeLogs(logs)) {
    const date = dayKey(log.smokedAt, timezone);
    const day = grouped.get(date) || { records: [], count: 0, spent: 0 };
    day.records.push(log);
    day.count += log.quantity;
    day.spent += log.quantity * log.priceSnapshot;
    grouped.set(date, day);
  }
  return grouped;
}
export function longestStreak(
  logs: CigaretteLog[],
  checkins: Checkin[],
  timezone: string,
  limit: number | GoalVersion[],
  kind: "smokeFree" | "withinLimit" | "logging",
) {
  const grouped = groupDays(logs, timezone);
  const zones = new Map([[timezone, grouped]]);
  let best = 0,
    current = 0,
    previous = "";
  for (const date of [...new Set(checkins.map((c) => c.date))].sort()) {
    const goal = Array.isArray(limit) ? goalOnDate(limit, date) : undefined;
    const ceiling = Array.isArray(limit)
      ? goal?.goalMode === "track"
        ? undefined
        : goal?.dailyLimit
      : limit;
    if (goal && !zones.has(goal.timezone))
      zones.set(goal.timezone, groupDays(logs, goal.timezone));
    const count =
      (kind === "withinLimit" && goal
        ? zones.get(goal.timezone)!
        : grouped
      ).get(date)?.count || 0;
    const qualifies =
      kind === "logging" ||
      (kind === "smokeFree"
        ? count === 0
        : ceiling !== undefined && count <= ceiling);
    current = qualifies
      ? previous && date === shiftDay(previous, 1)
        ? current + 1
        : 1
      : 0;
    best = Math.max(best, current);
    previous = date;
  }
  return best;
}
