import { goalOnDate } from "./goals";
import {
  activeLogs,
  dayKey,
  groupDays,
  longestStreak,
  perStick,
  shiftDay,
  type CigaretteLog,
  type Checkin,
  type Preferences,
} from "./domain";
export function milestones(
  logs: CigaretteLog[],
  checkins: Checkin[],
  p: Preferences,
  today: string,
) {
  const complete = checkins.filter((c) => c.date <= today);
  const smokeFree = longestStreak(
    logs,
    complete,
    p.timezone,
    p.dailyLimit,
    "smokeFree",
  );
  const within = longestStreak(
    logs,
    complete,
    p.timezone,
    p.goalHistory ?? [],
    "withinLimit",
  );
  const checked = new Set(complete.map((c) => c.date)).size;
  return [
    {
      id: "first",
      title: "A first check-in",
      description:
        "Confirm one day of tracking, including a zero-cigarette day.",
      unlocked: checked >= 1,
      progress: `${Math.min(checked, 1)} / 1 day`,
    },
    {
      id: "checkins",
      title: "Building awareness",
      description: "Complete check-ins on seven different days.",
      unlocked: checked >= 7,
      progress: `${Math.min(checked, 7)} / 7 days`,
    },
    {
      id: "free3",
      title: "A little more space",
      description: "Confirm three consecutive smoke-free days.",
      unlocked: smokeFree >= 3,
      progress: `${Math.min(smokeFree, 3)} / 3 days`,
    },
    {
      id: "free7",
      title: "A smoke-free week",
      description: "Confirm seven consecutive smoke-free days.",
      unlocked: smokeFree >= 7,
      progress: `${Math.min(smokeFree, 7)} / 7 days`,
    },
    ...(p.goalMode === "reduce"
      ? [
          {
            id: "limit",
            title: "Your chosen pace",
            description:
              "Complete seven consecutive days within the daily limit saved for each day.",
            unlocked: within >= 7,
            progress: `${Math.min(within, 7)} / 7 days`,
          },
        ]
      : []),
  ];
}
export function patterns(
  logs: CigaretteLog[],
  checkins: Checkin[],
  p: Preferences,
  today: string,
  period: number,
) {
  const start = shiftDay(today, 1 - period);
  const relevant = activeLogs(logs).filter((log) => {
    const date = dayKey(log.smokedAt, p.timezone);
    return date >= start && date <= today;
  });
  const hours = Array.from({ length: 24 }, () => 0);
  const format = new Intl.DateTimeFormat("en", {
    timeZone: p.timezone,
    hour: "numeric",
    hourCycle: "h23",
  });
  relevant.forEach((log) => {
    hours[Number(format.format(new Date(log.smokedAt)))] += log.quantity;
  });
  const completed = [
    ...new Set(
      checkins
        .filter((c) => c.date >= start && c.date <= today)
        .map((c) => c.date),
    ),
  ];
  const grouped = groupDays(logs, p.timezone);
  const zones = new Map([[p.timezone, grouped]]);
  const total = completed.reduce(
    (n, date) => n + (grouped.get(date)?.count ?? 0),
    0,
  );
  const compared = completed
    .map((date) => ({ date, goal: goalOnDate(p.goalHistory ?? [], date) }))
    .filter((row) => row.goal);
  const baselineTotal = compared.reduce(
    (sum, row) => sum + row.goal!.baseline,
    0,
  );
  const comparedTotal = compared.reduce((sum, row) => {
    const zone = row.goal!.timezone;
    if (!zones.has(zone)) zones.set(zone, groupDays(logs, zone));
    return sum + (zones.get(zone)!.get(row.date)?.count ?? 0);
  }, 0);
  return {
    hours,
    completed: completed.length,
    compared: compared.length,
    average: completed.length ? total / completed.length : null,
    baselineTotal,
    recordedTotal: total,
    estimatedDifference: compared.length
      ? (baselineTotal - comparedTotal) * perStick(p)
      : null,
  };
}
