import { goalOnDate, type GoalVersion } from "./goals";
import type { series } from "./domain";
import { money, dayTotals, type CigaretteLog } from "./domain";

type Data = ReturnType<typeof series>;
export function ActivityChart({
  data,
  limit,
  goalHistory,
  logs,
  metric = "count",
  monthly = false,
}: {
  data: Data;
  limit?: number;
  goalHistory?: GoalVersion[];
  logs?: CigaretteLog[];
  metric?: "count" | "spent";
  monthly?: boolean;
}) {
  const aboveLimit = (date: string, count: number) => {
    const goal = goalHistory ? goalOnDate(goalHistory, date) : undefined;
    const ceiling = goalHistory
      ? goal?.goalMode === "track"
        ? undefined
        : goal?.dailyLimit
      : limit;
    const historicalCount =
      goal && logs ? dayTotals(logs, date, goal.timezone).count : count;
    return ceiling !== undefined && historicalCount > ceiling;
  };
  const max = Math.max(
    metric === "count" ? limit || 5 : 10,
    ...data.map((d) => d[metric]),
    1,
  );
  const hasData = data.some((d) => d[metric] > 0);
  return (
    <div className="activity-chart">
      <div
        className="chart-plot"
        role="img"
        aria-label={data
          .map(
            (d) =>
              `${d.date}: ${metric === "spent" ? money(d.spent) : `${d.count} cigarettes`}`,
          )
          .join("; ")}
      >
        <div className="chart-grid">
          {[1, 0.75, 0.5, 0.25, 0].map((r) => (
            <div key={r}>
              <span>
                {metric === "spent"
                  ? `₱${Math.round(max * r)}`
                  : Math.round(max * r)}
              </span>
              <i />
            </div>
          ))}
        </div>
        {limit !== undefined && metric === "count" && (
          <div
            className="limit-line"
            style={{ bottom: `${(limit / max) * 100}%` }}
          >
            <span>Today’s limit · reference</span>
          </div>
        )}
        <div className="bars">
          {data.map((d, i) => (
            <div className="bar-column" key={d.date}>
              <div
                className={`bar ${i === data.length - 1 ? "today" : ""} ${aboveLimit(d.date, d.count) && metric === "count" && !monthly ? "over" : ""}`}
                style={{ height: `${Math.max((d[metric] / max) * 100, 1.5)}%` }}
                title={`${d.date}: ${d[metric]}`}
              >
                <span>
                  {d[metric] > 0
                    ? metric === "spent"
                      ? money(d.spent)
                      : d.count
                    : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
        {!hasData && (
          <div className="chart-empty">
            Your next chapter starts here.
            <span>Your records will bring this chart to life.</span>
          </div>
        )}
      </div>
      <div className="chart-labels">
        {data.map((d, i) => (
          <span className={i === data.length - 1 ? "current" : ""} key={d.date}>
            {monthly
              ? new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en", {
                  month: "short",
                  timeZone: "UTC",
                })
              : data.length <= 7
                ? new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en", {
                    weekday: "short",
                    timeZone: "UTC",
                  })
                : i % 5 === 0 || i === data.length - 1
                  ? Number(d.date.slice(-2))
                  : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
