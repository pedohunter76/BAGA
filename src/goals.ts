import { dayKey, type Preferences } from "./domain";
import type { GoalVersion } from "./goal-schema";
export {
  goalHistorySchema,
  goalVersionSchema,
  goalOnDate,
  type GoalVersion,
} from "./goal-schema";
export function currentGoal(p: Preferences, now = new Date()): GoalVersion {
  return {
    effectiveDate: dayKey(now, p.timezone),
    timezone: p.timezone,
    goalMode: p.goalMode,
    dailyLimit: p.dailyLimit,
    baseline: p.baseline,
    weeklyReduction: p.weeklyReduction,
    quitAt: p.quitAt,
  };
}
export function withGoalHistory(
  p: Preferences,
  previous?: Preferences,
  now = new Date(),
): Preferences {
  if (!p.onboarded) return p;
  const history = [...(previous?.goalHistory ?? p.goalHistory ?? [])];
  const next = currentGoal(p, now);
  const latest = history.at(-1);
  if (
    latest &&
    Object.keys(next)
      .filter((key) => key !== "effectiveDate")
      .every(
        (key) =>
          latest[key as keyof GoalVersion] === next[key as keyof GoalVersion],
      )
  )
    return { ...p, goalHistory: history };
  // A westward timezone change must not rewrite an earlier calendar date.
  if (latest && next.effectiveDate < latest.effectiveDate)
    next.effectiveDate = latest.effectiveDate;
  if (latest?.effectiveDate === next.effectiveDate) history.pop();
  if (history.length >= 1000)
    throw new Error(
      "Your goal history is full. Export your diary before starting a new history.",
    );
  history.push(next);
  return { ...p, goalHistory: history };
}
