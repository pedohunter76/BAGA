import { Award, Leaf, Flame, CheckCheck, Sparkles } from "lucide-react";
import { useApp } from "./context";
import { dayKey, money } from "./domain";
import { milestones, patterns } from "./progress";
import { CardTitle } from "./ui";

function getMilestoneIcon(id: string) {
  if (id.startsWith("free")) return Leaf;
  if (id.startsWith("limit") || id.startsWith("within")) return Flame;
  if (id === "checkins" || id === "first") return CheckCheck;
  return Award;
}

export function MilestoneCards() {
  const { logs, checkins, preferences: p, now } = useApp();
  const rows = milestones(logs, checkins, p, dayKey(now, p.timezone));
  return (
    <section className="card">
      <CardTitle
        title="Small milestones"
        subtitle="Progress comes from awareness and your chosen goals. Recording a cigarette never earns an achievement."
        action={<Sparkles size={22} />}
      />
      <div className="milestone-grid">
        {rows.map((row) => {
          const Icon = getMilestoneIcon(row.id);
          return (
            <article
              key={row.id}
              className={`milestone-card ${row.unlocked ? "unlocked" : ""}`}
            >
              <Icon size={24} />
              <span className="pill">
                {row.unlocked ? "Unlocked" : row.progress}
              </span>
              <h3>{row.title}</h3>
              <p>{row.description}</p>
            </article>
          );
        })}
      </div>
      <p className="settings-copy">
        Milestones recalculate when history changes. Missing days never count as
        smoke-free. Within-limit milestones use the goal saved for each day.
        Days without known goals do not count toward a within-limit milestone.
      </p>
    </section>
  );
}
export function PatternCards({ period }: { period: number }) {
  const { logs, checkins, preferences: p, now } = useApp();
  const data = patterns(logs, checkins, p, dayKey(now, p.timezone), period);
  const maximum = Math.max(...data.hours, 1);
  const peak = data.hours.some(Boolean)
    ? data.hours.indexOf(Math.max(...data.hours))
    : null;
  return (
    <div className="two-column">
      <section className="card">
        <CardTitle
          title="The moments you record"
          subtitle={`Hourly cigarette totals over ${period} days · ${p.timezone}`}
        />
        <div
          className="hour-pattern"
          role="img"
          aria-label={data.hours
            .map((count, hour) => `${hour}:00: ${count} cigarettes`)
            .join("; ")}
        >
          {data.hours.map((count, hour) => (
            <div key={hour} title={`${hour}:00 · ${count} cigarettes`}>
              <i
                style={{
                  height: `${Math.max(2, (count / maximum) * 100)}%`,
                  opacity: count ? 1 : 0.2,
                }}
              />
              <span>{hour % 4 === 0 ? String(hour).padStart(2, "0") : ""}</span>
            </div>
          ))}
        </div>
        <p className="settings-copy">
          {peak === null
            ? "Hourly patterns will appear after your first diary record."
            : `Your highest recorded hour is ${String(peak).padStart(2, "0")}:00–${String(peak).padStart(2, "0")}:59. This describes your entries, not untracked time.`}
        </p>
        <details>
          <summary>View hourly totals</summary>
          <div className="hour-totals">
            {data.hours.map((n, h) => (
              <span key={h}>
                {String(h).padStart(2, "0")}:00 · {n}
              </span>
            ))}
          </div>
        </details>
      </section>
      <section className="card">
        <CardTitle
          title="A peso perspective"
          subtitle="Compare completed days with your chosen baseline."
        />
        <dl className="sync-summary">
          <div>
            <dt>Completed days</dt>
            <dd>
              {data.completed} / {period}
            </dd>
          </div>
          <div>
            <dt>Days with a saved baseline</dt>
            <dd>{data.compared} days</dd>
          </div>
          <div>
            <dt>Recorded on completed days</dt>
            <dd>{data.recordedTotal} sticks</dd>
          </div>
          <div>
            <dt>Estimated spending difference</dt>
            <dd>
              {data.estimatedDifference === null || perPriceMissing(p.price)
                ? "—"
                : money(data.estimatedDifference)}
            </dd>
          </div>
        </dl>
        <p className="settings-copy">
          A positive difference estimates spending below your baseline; a
          negative difference estimates spending above it. It uses your current
          chosen price and completed days with a saved baseline. Earlier unknown
          baselines are excluded. It is an estimate, not a bank balance or
          evidence of better lung function.
        </p>
        {!p.price && (
          <p className="settings-copy">
            Set your current price in Settings to see an estimate.
          </p>
        )}
      </section>
    </div>
  );
}
function perPriceMissing(price: number) {
  return price === 0;
}
