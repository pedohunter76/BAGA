import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Plus,
  Check,
  Flame,
  Wallet,
  Leaf,
  Clock3,
  SlidersHorizontal,
  ChevronRight,
  ChevronLeft,
  Cigarette,
  Wind,
  Info,
  Search,
  Flag,
  ShieldCheck,
  Download,
  Bell,
  Trash2,
  Heart,
  X,
  Sparkles,
  CalendarDays,
  CheckCheck,
} from "lucide-react";
import { useApp } from "./context";
import { exportDiagnostics } from "./diagnostics";
import { goalOnDate } from "./goals";
import { NotificationSettings } from "./NotificationSettings";
import { BackupRestore } from "./BackupRestore";
import { MilestoneCards, PatternCards } from "./ProgressCards";
import { db, savePreferences, saveMeasurement, eraseData } from "./db";
import {
  activeLogs,
  catalog,
  dayKey,
  dayTotals,
  formatTime,
  localDateTime,
  fromLocalDateTime,
  money,
  perStick,
  series,
  shiftDay,
  streak,
  longestStreak,
  triggers,
} from "./domain";
import type { CigaretteLog, Preferences } from "./domain";
import { PageTitle, CardTitle, Empty, TextLink, Field, Modal } from "./ui";
import { ActivityChart } from "./charts";
import { CigaretteTracker } from "./CigaretteTracker";

function useStats() {
  const { preferences: p, logs, checkins, now } = useApp();
  const today = dayKey(now, p.timezone);
  const totals = dayTotals(logs, today, p.timezone);
  return {
    today,
    ...totals,
    week: series(logs, today, p.timezone, 7),
    smokeFree: streak(
      logs,
      checkins,
      today,
      p.timezone,
      p.dailyLimit,
      "smokeFree",
    ),
    withinLimit: streak(
      logs,
      checkins,
      today,
      p.timezone,
      p.goalHistory ?? [],
      "withinLimit",
    ),
    loggingStreak: streak(
      logs,
      checkins,
      today,
      p.timezone,
      p.dailyLimit,
      "logging",
    ),
    checked: checkins.some((c) => c.date === today),
  };
}
export function CheckinButton({
  date,
  className = "button secondary",
}: {
  date?: string;
  className?: string;
}) {
  const {
    logs,
    checkins,
    preferences: p,
    perform,
    now,
    openOnboarding,
  } = useApp();
  const [confirming, setConfirming] = useState(false);
  const key = date || dayKey(now, p.timezone);
  const count = dayTotals(logs, key, p.timezone).count;
  const completed = checkins.some((c) => c.date === key);
  return (
    <>
      <button
        className={className}
        onClick={() => {
          if (!p.onboarded) openOnboarding();
          else setConfirming(true);
        }}
      >
        <Check size={16} />
        {completed
          ? "Review check-in"
          : count === 0
            ? "Smoke-free check-in"
            : "Complete daily check-in"}
      </button>
      {confirming && (
        <Modal
          open
          title="A moment to check in."
          description={`Confirm your diary for ${key} · ${p.timezone}`}
          onClose={() => setConfirming(false)}
        >
          <div className="checkin-summary">
            <Leaf size={36} />
            <strong>
              {count === 0
                ? "A smoke-free day?"
                : `${count} cigarette${count === 1 ? "" : "s"} recorded`}
            </strong>
            <p>
              {count === 0
                ? "Confirm that you haven’t smoked on this date. Missing days are never automatically counted as smoke-free."
                : "Have you recorded everything for this date? Your check-in helps keep your streaks accurate."}
            </p>
          </div>
          <div className="notice">
            <Info size={18} />
            <span>
              You can still add or edit records later. Your streaks will
              recalculate.
            </span>
          </div>
          <div className="modal-actions">
            <button
              className="button primary"
              onClick={async () => {
                const ok = await perform(async () => {
                  if (key > dayKey(new Date(), p.timezone))
                    throw new Error("Future days cannot be checked in.");
                  await db.transaction(
                    "rw",
                    [db.logs, db.checkins],
                    async () => {
                      const current = await db.logs.toArray();
                      await db.checkins.put({
                        date: key,
                        confirmedCount: dayTotals(current, key, p.timezone)
                          .count,
                        completedAt: new Date().toISOString(),
                      });
                    },
                  );
                }, "Daily check-in saved.");
                if (ok) setConfirming(false);
              }}
            >
              <CheckCheck size={18} />
              Confirm check-in
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function LogRow({
  log,
  showDate = false,
}: {
  log: CigaretteLog;
  showDate?: boolean;
}) {
  const { preferences: p, openLog } = useApp();
  return (
    <button
      className="log-row"
      onClick={() => openLog(log)}
      aria-label={`Edit ${log.quantity} ${log.brand} ${log.variant}, ${formatTime(log.smokedAt, p.timezone)}`}
    >
      <span className="log-icon">
        <Cigarette size={18} />
      </span>
      <span className="log-description">
        <strong>
          {log.brand}
          <span> · {log.variant}</span>
        </strong>
        <small>
          {showDate ? `${dayKey(log.smokedAt, p.timezone)} · ` : ""}
          {formatTime(log.smokedAt, p.timezone)}
          {log.trigger !== "None" ? ` · ${log.trigger}` : ""}
        </small>
      </span>
      <span className="log-quantity">
        {log.quantity} stick{log.quantity > 1 ? "s" : ""}
        <small>{money(log.quantity * log.priceSnapshot)}</small>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}

export function Dashboard() {
  const {
    preferences: p,
    logs,
    now,
    navigate,
    quickLog,
    openLog,
    openOnboarding,
  } = useApp();
  const s = useStats();
  const favorite = [...catalog, ...useApp().customVariants].find(
    (v) => v.id === p.favoriteId,
  );
  const remaining = Math.max(0, p.dailyLimit - s.count);
  const ratio =
    p.dailyLimit === 0
      ? s.count > 0
        ? 1
        : 0
      : Math.min(1, s.count / p.dailyLimit);
  const over =
    p.onboarded &&
    p.goalMode !== "track" &&
    s.count >= p.dailyLimit &&
    s.count > 0;
  const latest = activeLogs(logs).sort((a, b) =>
    b.smokedAt.localeCompare(a.smokedAt),
  )[0];
  const elapsed = latest
    ? Math.max(
        0,
        Math.floor((now.getTime() - Date.parse(latest.smokedAt)) / 60_000),
      )
    : 0;
  return (
    <>
      <PageTitle
        eyebrow="A LITTLE AWARENESS, EVERY DAY"
        title={p.name ? `One day at a time, ${p.name}.` : "One day at a time."}
        description="Your daily breath. Your habits. Your progress."
        action={
          <button
            className="button secondary compact"
            onClick={() => navigate("goals")}
          >
            <SlidersHorizontal size={16} />
            My goals
          </button>
        }
      />
      <div className="dashboard-hero">
        <section className={`card daily-card ${over ? "limit-reached" : ""}`}>
          <CardTitle title="Today’s overview" />
          <div className="daily-card-body">
            <div className="count-ring">
              <svg viewBox="0 0 240 240" aria-hidden="true">
                <circle cx="120" cy="120" r="105" className="ring-track" />
                <circle
                  cx="120"
                  cy="120"
                  r="105"
                  className="ring-progress"
                  strokeDasharray="659.73"
                  strokeDashoffset={659.73 * (1 - ratio)}
                  transform="rotate(-90 120 120)"
                />
              </svg>
              <div className="count-ring-label">
                <span className="small-caps">CIGARETTES TODAY</span>
                <strong data-testid="today-count">
                  {s.count}
                  <span>
                    {p.goalMode !== "track" && p.onboarded
                      ? ` / ${p.dailyLimit}`
                      : ""}
                  </span>
                </strong>
                <span className="ring-caption">
                  {!p.onboarded
                    ? "Let’s start with today"
                    : p.goalMode === "track"
                      ? "A little more awareness"
                      : p.dailyLimit === 0
                        ? "Your goal is a smoke-free day"
                        : "your chosen daily limit"}
                </span>
              </div>
            </div>
            <CigaretteTracker
              count={s.count}
              dailyLimit={p.dailyLimit}
              goalMode={p.goalMode}
              onboarded={p.onboarded}
            />
          </div>
          <div className="daily-card-footer">
            <button className="button primary quick-log" onClick={quickLog}>
              <Plus size={20} />
              Log cigarette<span>+1</span>
            </button>
            <button
              className="button icon-outline"
              aria-label="Log with details"
              onClick={() => openLog()}
            >
              <SlidersHorizontal size={19} />
            </button>
          </div>
          <p className="favorite-caption">
            {p.onboarded
              ? `${favorite?.brand || "Custom"} · ${favorite?.name || ""} · ${money(perStick(p))} / stick`
              : "Set up your favorite for one-tap logging"}
            <span>Undo after a quick log</span>
          </p>
        </section>
      </div>
      <div className={`stats-grid ${!p.showSpending ? "two" : ""}`}>
        <section className="card stat-card">
          <span className="stat-icon green">
            <Flame size={20} />
          </span>
          <div>
            <span className="stat-label">Within-limit streak</span>
            <strong>
              {p.goalMode === "track" ? "—" : s.withinLimit}
              <small>
                {p.goalMode === "track"
                  ? "tracking mode"
                  : s.withinLimit === 1
                    ? "day"
                    : "days"}
              </small>
            </strong>
            <p>
              {s.withinLimit
                ? "Built on completed daily check-ins"
                : "Your next check-in is a fresh start"}
            </p>
          </div>
          <button
            className="stat-link"
            aria-label="View streaks"
            onClick={() => navigate("goals")}
          >
            <ArrowUpRight size={17} />
          </button>
        </section>
        {p.showSpending && (
          <section className="card stat-card">
            <span className="stat-icon peach">
              <Wallet size={20} />
            </span>
            <div>
              <span className="stat-label">Today’s spending</span>
              <strong>{money(s.spent)}</strong>
              <p>
                {p.price === 0 && !s.spent
                  ? "Set a price for meaningful totals"
                  : "From the prices saved with each record"}
              </p>
            </div>
            <button
              className="stat-link"
              aria-label="View spending insights"
              onClick={() => navigate("insights")}
            >
              <ArrowUpRight size={17} />
            </button>
          </section>
        )}
        <section className="card stat-card">
          <span className="stat-icon lavender">
            <Leaf size={20} />
          </span>
          <div>
            <span className="stat-label">Smoke-free streak</span>
            <strong>
              {s.smokeFree}
              <small>{s.smokeFree === 1 ? "day" : "days"}</small>
            </strong>
            <p>Confirmed days. Every one counts.</p>
            <CheckinButton className="button secondary compact checkin-stat-btn" />
          </div>
          <button
            className="stat-link"
            aria-label="View smoke-free progress"
            onClick={() => navigate("goals")}
          >
            <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="card weekly-card">
          <CardTitle
            title="Your week, in perspective"
            subtitle="A clearer picture of your daily habits."
            action={
              <TextLink onClick={() => navigate("insights")}>
                View insights
              </TextLink>
            }
          />
          <div className="chart-meta">
            <span>
              <i className="legend-dot" />
              Cigarettes recorded
            </span>
            <span>LAST 7 DAYS</span>
          </div>
          <ActivityChart
            goalHistory={p.goalHistory ?? []}
            logs={logs}
            data={s.week}
            limit={
              p.onboarded && p.goalMode !== "track" ? p.dailyLimit : undefined
            }
          />
          <div className="chart-summary">
            <span>
              <strong>{s.week.reduce((sum, d) => sum + d.count, 0)}</strong>{" "}
              recorded this week
            </span>
            <span>Progress begins with noticing.</span>
          </div>
        </section>
      </div>
      <div className="gentle-note">
        <span>✦</span>
        <p>
          You don’t have to change everything today. Just start by paying
          attention.
        </p>
        <span>ONE DAY AT A TIME</span>
      </div>
    </>
  );
}

export function History() {
  const { logs, preferences: p, openLog, now, customVariants } = useApp();
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("all");
  const [brand, setBrand] = useState("all");
  const [visible, setVisible] = useState(20);
  const today = dayKey(now, p.timezone);
  const from =
    period === "today"
      ? today
      : period === "week"
        ? shiftDay(today, -6)
        : period === "month"
          ? today.slice(0, 8) + "01"
          : "0000";
  const filtered = activeLogs(logs)
    .filter(
      (log) =>
        dayKey(log.smokedAt, p.timezone) >= from &&
        (brand === "all" || log.brand === brand) &&
        `${log.brand} ${log.variant} ${log.notes} ${log.trigger}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.smokedAt.localeCompare(a.smokedAt));
  const brands = [
    ...new Set([...catalog, ...customVariants].map((v) => v.brand)),
  ];
  return (
    <>
      <PageTitle
        eyebrow="YOUR PERSONAL RECORD"
        title="Every day tells a story."
        description="An honest diary of your habits. Edit it whenever you need."
        action={
          <button className="button primary" onClick={() => openLog()}>
            <Plus size={19} />
            Add record
          </button>
        }
      />
      <section className="card">
        <div className="filters">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Search diary"
              placeholder="Search brand, trigger or notes…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(20);
              }}
            />
          </label>
          <select
            aria-label="Filter by period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">This month</option>
          </select>
          <select
            aria-label="Filter by brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="history-summary">
          <span>
            <strong>{filtered.reduce((n, log) => n + log.quantity, 0)}</strong>{" "}
            cigarettes · {filtered.length} records
          </span>
          <span>
            {money(
              filtered.reduce(
                (n, log) => n + log.quantity * log.priceSnapshot,
                0,
              ),
            )}{" "}
            total
          </span>
        </div>
        {filtered.length ? (
          <div className="history-list">
            {filtered.slice(0, visible).map((log) => (
              <LogRow key={log.id} log={log} showDate />
            ))}
          </div>
        ) : (
          <Empty
            title={
              search || period !== "all" || brand !== "all"
                ? "No matching records."
                : "Your story starts here."
            }
          >
            {search
              ? "Try a different search or clear your filters."
              : "Add a record when you need to. All entries are saved on this device."}
          </Empty>
        )}
        {filtered.length > visible && (
          <div className="load-more">
            <button
              className="button secondary"
              onClick={() => setVisible(visible + 20)}
            >
              Load more records
            </button>
          </div>
        )}
      </section>
      <div className="notice">
        <ShieldCheck size={18} />
        <span>
          Your diary is saved offline. Changing a brand’s price won’t change
          past spending.
        </span>
      </div>
    </>
  );
}

export function Insights() {
  const { logs, preferences: p, now, checkins } = useApp();
  const [period, setPeriod] = useState<7 | 30 | 365>(7);
  const [metric, setMetric] = useState<"count" | "spent">("count");
  const today = dayKey(now, p.timezone);
  const data = series(logs, today, p.timezone, period);
  const relevant = data.flatMap((d) => d.records);
  const count = relevant.reduce((n, log) => n + log.quantity, 0);
  const spent = relevant.reduce(
    (n, log) => n + log.quantity * log.priceSnapshot,
    0,
  );
  const complete = data.filter((d) => checkins.some((c) => c.date === d.date));
  const average = complete.length
    ? complete.reduce((n, d) => n + d.count, 0) / complete.length
    : null;
  const byBrand = Object.entries(
    relevant.reduce<Record<string, { count: number; spent: number }>>(
      (acc, log) => {
        const key = `${log.brand} · ${log.variant}`;
        acc[key] ||= { count: 0, spent: 0 };
        acc[key].count += log.quantity;
        acc[key].spent += log.quantity * log.priceSnapshot;
        return acc;
      },
      {},
    ),
  ).sort((a, b) => b[1].count - a[1].count);
  const byTrigger = Object.entries(
    relevant
      .filter((log) => log.trigger !== "None")
      .reduce<Record<string, number>>((acc, log) => {
        acc[log.trigger] = (acc[log.trigger] || 0) + log.quantity;
        return acc;
      }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const monthKeys = [...new Set(data.map((d) => d.date.slice(0, 7)))];
  const chartData =
    period === 365
      ? monthKeys.map((key) => {
          const rows = data.filter((x) => x.date.startsWith(key));
          return {
            date: `${key}-01`,
            count: rows.reduce((n, r) => n + r.count, 0),
            spent: rows.reduce((n, r) => n + r.spent, 0),
            records: rows.flatMap((r) => r.records),
          };
        })
      : data;
  return (
    <>
      <PageTitle
        eyebrow="NOTICE THE PATTERNS"
        title="A little more perspective."
        description="Your habits and spending, in a clearer light."
        action={
          <div className="segmented">
            {([7, 30, 365] as const).map((d) => (
              <button
                className={period === d ? "active" : ""}
                key={d}
                onClick={() => setPeriod(d)}
              >
                {d === 7 ? "7 days" : d === 30 ? "30 days" : "365 days"}
              </button>
            ))}
          </div>
        }
      />
      <div className="stats-grid">
        <section className="card metric-card">
          <Cigarette size={21} />
          <span>Cigarettes recorded</span>
          <strong>{count}</strong>
          <p>Across the selected {period} days.</p>
        </section>
        <section className="card metric-card">
          <Wallet size={21} />
          <span>Recorded spending</span>
          <strong>{money(spent)}</strong>
          <p>Historical prices, kept intact.</p>
        </section>
        <section className="card metric-card">
          <CheckCheck size={21} />
          <span>Average on completed days</span>
          <strong>{average === null ? "—" : average.toFixed(1)}</strong>
          <p>
            {complete.length
              ? `${complete.length} completed days · not untracked days`
              : "Complete a check-in to see your average."}
          </p>
        </section>
      </div>
      <section className="card">
        <CardTitle
          title={
            metric === "count"
              ? "Your habits over time"
              : "Your peso perspective"
          }
          subtitle={
            period === 365
              ? "Recorded totals grouped by month in the last 365 days."
              : "Daily records in your chosen timezone."
          }
          action={
            <div className="segmented">
              <button
                className={metric === "count" ? "active" : ""}
                onClick={() => setMetric("count")}
              >
                Cigarettes
              </button>
              <button
                className={metric === "spent" ? "active" : ""}
                onClick={() => setMetric("spent")}
              >
                Spending
              </button>
            </div>
          }
        />
        <ActivityChart
          goalHistory={p.goalHistory ?? []}
          logs={logs}
          data={chartData}
          monthly={period === 365}
          metric={metric}
          limit={
            metric === "count" && period !== 365 && p.goalMode !== "track"
              ? p.dailyLimit
              : undefined
          }
        />
      </section>
      <div className="two-column">
        <section className="card">
          <CardTitle
            title="Your brand breakdown"
            subtitle="Consumption summaries, never endorsements."
          />
          {byBrand.length ? (
            byBrand.map(([brand, stats]) => (
              <div className="breakdown-row" key={brand}>
                <div>
                  <strong>{brand}</strong>
                  <span>
                    {stats.count} sticks · {money(stats.spent)}
                  </span>
                </div>
                <div className="progress-track">
                  <i
                    style={{
                      width: `${(stats.count / Math.max(count, 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <Empty title="More clarity, as you go.">
              Brand totals will appear after your first record.
            </Empty>
          )}
        </section>
        <section className="card">
          <CardTitle
            title="What tends to trigger it?"
            subtitle="Patterns to notice, without judgment."
          />
          {byTrigger.length ? (
            byTrigger.map(([trigger, n]) => (
              <div className="trigger-row" key={trigger}>
                <span>{trigger}</span>
                <strong>
                  {n}
                  <small> recorded</small>
                </strong>
              </div>
            ))
          ) : (
            <Empty title="A little context helps.">
              Add a trigger when logging to understand the moments behind your
              habits.
            </Empty>
          )}
        </section>
      </div>
      <PatternCards period={period} />
    </>
  );
}

export function Goals() {
  const {
    preferences: p,
    logs,
    checkins,
    perform,
    openOnboarding,
    now,
  } = useApp();
  const s = useStats();
  const [form, setForm] = useState({
    mode: p.goalMode,
    limit: p.dailyLimit,
    baseline: p.baseline,
    weeklyReduction: p.weeklyReduction,
    quitDate: p.quitAt ? localDateTime(p.quitAt, p.timezone) : "",
  });
  const quitElapsed = p.quitAt
    ? Math.floor((now.getTime() - Date.parse(p.quitAt)) / 86400000)
    : null;
  const completedWeek = s.week.filter((d) =>
    checkins.some((c) => c.date === d.date),
  );
  const average = completedWeek.length
    ? completedWeek.reduce((n, d) => n + d.count, 0) / completedWeek.length
    : null;
  const reduction =
    average !== null && p.baseline > 0
      ? ((p.baseline - average) / p.baseline) * 100
      : null;
  const best = (kind: "smokeFree" | "withinLimit" | "logging") =>
    longestStreak(logs, checkins, p.timezone, p.goalHistory ?? [], kind);
  return (
    <>
      <PageTitle
        eyebrow="PROGRESS AT YOUR PACE"
        title="Small steps. Your steps."
        description="A goal should support you, never put pressure on you."
      />
      <div className="stats-grid">
        <section className="card streak-card">
          <Leaf size={24} />
          <span>Smoke-free streak</span>
          <strong>
            {s.smokeFree}
            <small>days</small>
          </strong>
          <p>Personal best: {best("smokeFree")} days</p>
        </section>
        <section className="card streak-card">
          <Flame size={24} />
          <span>Within-limit streak</span>
          <strong>
            {p.goalMode === "track" ? "—" : s.withinLimit}
            <small>days</small>
          </strong>
          <p>
            {p.goalMode === "track"
              ? "No limit in tracking mode"
              : `Personal best: ${best("withinLimit")} days`}
          </p>
        </section>
        <section className="card streak-card">
          <CheckCheck size={24} />
          <span>Check-in streak</span>
          <strong>
            {s.loggingStreak}
            <small>days</small>
          </strong>
          <p>Zero-cigarette check-ins count, too.</p>
        </section>
      </div>
      <section className="card goal-history">
        <CardTitle
          title="Your goal history"
          subtitle="Days before your first saved goal have no known limit."
        />
        {(p.goalHistory ?? []).length ? (
          <ol>
            {[...(p.goalHistory ?? [])].reverse().map((goal) => (
              <li key={goal.effectiveDate}>
                <strong>{goal.effectiveDate}</strong>
                <span>
                  {goal.goalMode === "track"
                    ? "Tracking only"
                    : `${goal.dailyLimit} daily limit`}{" "}
                  · {goal.timezone}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="settings-copy">
            Save a goal to start your history. Earlier limits won’t be guessed.
          </p>
        )}
      </section>
      <div className="two-column">
        <section className="card">
          <CardTitle
            title="Find your pace"
            subtitle="Changes apply today. Earlier days keep their saved goals."
          />
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!p.onboarded) {
                openOnboarding();
                return;
              }
              await perform(
                () =>
                  savePreferences({
                    ...p,
                    goalMode: form.mode,
                    dailyLimit: form.limit,
                    baseline: form.baseline,
                    weeklyReduction: form.weeklyReduction,
                    quitAt: form.quitDate
                      ? fromLocalDateTime(form.quitDate, p.timezone)
                      : "",
                  }),
                "Your goal is saved.",
              );
            }}
          >
            <Field label="My goal">
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm({ ...form, mode: e.target.value as typeof form.mode })
                }
              >
                <option value="reduce">Reduce at my own pace</option>
                <option value="quit">Work toward quitting</option>
                <option value="track">
                  Understand my habits · tracking only
                </option>
              </select>
            </Field>
            {form.mode !== "track" && (
              <Field
                label="Daily cigarette limit"
                hint="A ceiling, never a target to reach. Set 0 for a smoke-free goal."
              >
                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  value={form.limit}
                  onChange={(e) =>
                    setForm({ ...form, limit: Number(e.target.value) })
                  }
                />
              </Field>
            )}
            {form.mode === "reduce" && (
              <Field
                label="My previous daily baseline"
                hint="Your own reference for comparison, not a recommended amount."
              >
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={form.baseline}
                  onChange={(e) =>
                    setForm({ ...form, baseline: Number(e.target.value) })
                  }
                />
              </Field>
            )}
            {form.mode === "reduce" && (
              <Field
                label="Weekly reduction target (%)"
                hint="Compare your completed-day weekly average with your chosen baseline."
              >
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={form.weeklyReduction}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      weeklyReduction: Number(e.target.value),
                    })
                  }
                />
              </Field>
            )}
            {form.mode === "quit" && (
              <Field label={`My quit date · ${p.timezone}`}>
                <input
                  required
                  type="datetime-local"
                  value={form.quitDate}
                  onChange={(e) =>
                    setForm({ ...form, quitDate: e.target.value })
                  }
                />
              </Field>
            )}
            <button className="button primary">
              <Flag size={18} />
              Save my goal
            </button>
          </form>
        </section>
        <div className="goal-side">
          <section className="card">
            <CardTitle title="Your progress, honestly" />
            {p.goalMode === "reduce" ? (
              <div className="reduction-preview">
                <span className="small-caps">VS YOUR CHOSEN BASELINE</span>
                <strong
                  className={
                    reduction !== null && reduction < 0 ? "above-baseline" : ""
                  }
                >
                  {reduction === null
                    ? "—"
                    : `${Math.abs(reduction).toFixed(0)}% ${reduction < 0 ? "higher" : "less"}`}
                </strong>
                <span className="goal-target">
                  Your weekly target: {p.weeklyReduction}% ·{" "}
                  {(p.baseline * (1 - p.weeklyReduction / 100)).toFixed(1)} /
                  day
                </span>
                <p>
                  {average === null
                    ? "Complete daily check-ins to compare your recorded average with your baseline."
                    : `${average.toFixed(1)} / day on ${completedWeek.length} completed days this week, vs your ${p.baseline} / day baseline.`}
                </p>
              </div>
            ) : p.goalMode === "quit" ? (
              <div className="reduction-preview">
                <strong>
                  {quitElapsed === null
                    ? "Not set"
                    : quitElapsed < 0
                      ? `${Math.abs(quitElapsed)} days`
                      : `${quitElapsed} days`}
                </strong>
                <p>
                  {quitElapsed !== null && quitElapsed < 0
                    ? "Until your selected quit date."
                    : "Elapsed since your selected quit date. Smoke-free streaks are confirmed separately."}
                </p>
              </div>
            ) : (
              <Empty title="Awareness is a goal, too.">
                Track your habits without a daily target. Your check-ins still
                build consistency.
              </Empty>
            )}
            <p className="fine-print">
              Lower cigarette consumption does not establish improved lung
              function.
            </p>
          </section>
          <section className="goal-checkin">
            <span className="leaf-badge">
              <Check size={22} />
            </span>
            <h3>Show up for yourself.</h3>
            <p>
              Confirm your diary today. A smoke-free day belongs in your story,
              too.
            </p>
            <CheckinButton />
          </section>
        </div>
      </div>
      <MilestoneCards />
      <div className="notice">
        <Info size={18} />
        <span>
          Streaks use completed check-ins in {p.timezone}. Missing days break a
          streak; backdated edits recalculate it. Within-limit history uses your
          current chosen limit.
        </span>
      </div>
    </>
  );
}

export function Calendar() {
  const { logs, checkins, preferences: p, now, openLog } = useApp();
  const today = dayKey(now, p.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const totals = dayTotals(logs, selected, p.timezone);
  function moveMonth(n: number) {
    const next = new Date(first);
    next.setUTCMonth(next.getUTCMonth() + n);
    setMonth(next.toISOString().slice(0, 7));
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR DAYS, IN COLOR"
        title="Your smoking calendar."
        description="Recorded days, confirmed days, and the spaces in between."
      />
      <div className="calendar-layout">
        <section className="card">
          <CardTitle
            title={first.toLocaleDateString("en", {
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
            action={
              <div className="calendar-controls">
                <button
                  className="icon-button"
                  aria-label="Previous month"
                  onClick={() => moveMonth(-1)}
                >
                  <ChevronLeft size={19} />
                </button>
                <button
                  className="button secondary compact"
                  onClick={() => {
                    setMonth(today.slice(0, 7));
                    setSelected(today);
                  }}
                >
                  Today
                </button>
                <button
                  className="icon-button"
                  aria-label="Next month"
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            }
          />
          <div className="calendar-grid">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <span className="weekday" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              const n = dayTotals(logs, date, p.timezone).count;
              const confirmed = checkins.some((c) => c.date === date);
              return (
                <button
                  key={date}
                  className={`calendar-day ${selected === date ? "selected" : ""} ${date === today ? "is-today" : ""} ${confirmed && n === 0 ? "smoke-free" : goalOnDate(p.goalHistory ?? [], date)?.goalMode !== "track" && goalOnDate(p.goalHistory ?? [], date) !== undefined && dayTotals(logs, date, goalOnDate(p.goalHistory ?? [], date)!.timezone).count > goalOnDate(p.goalHistory ?? [], date)!.dailyLimit ? "above-limit" : n ? "has-records" : ""}`}
                  onClick={() => setSelected(date)}
                  aria-label={`${date}, ${n} cigarettes, ${confirmed ? "checked in" : "not checked in"}`}
                >
                  <strong>{i + 1}</strong>
                  {confirmed && n === 0 ? (
                    <Leaf size={18} />
                  ) : n ? (
                    <span>
                      {n}
                      <small> sticks</small>
                    </span>
                  ) : (
                    <span className="untracked">—</span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="legend-dot" />
              Confirmed smoke-free
            </span>
            <span>
              <i className="legend-dot peach" />
              Records
            </span>
            <span>— Untracked</span>
          </div>
        </section>
        <section className="card calendar-detail">
          <CardTitle
            title={new Date(`${selected}T12:00:00Z`).toLocaleDateString("en", {
              month: "long",
              day: "numeric",
              timeZone: "UTC",
            })}
            subtitle={
              checkins.some((c) => c.date === selected)
                ? "Daily check-in completed"
                : selected > today
                  ? "This day hasn’t arrived yet."
                  : "Check-in not completed"
            }
          />
          <div className="calendar-day-total">
            <strong>{totals.count}</strong>
            <span>cigarettes recorded</span>
            <b>{money(totals.spent)}</b>
          </div>
          {totals.records.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
          {selected <= today && (
            <>
              <CheckinButton date={selected} />
              <button
                className="text-link"
                onClick={() => openLog(undefined, selected)}
              >
                <Plus size={16} />
                Add a backdated record
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}

export function LibraryPage() {
  const { preferences: p, customVariants, perform, openOnboarding } = useApp();
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState(false);
  const [brand, setBrand] = useState("");
  const [variant, setVariant] = useState("");
  const variants = [...catalog, ...customVariants].filter((v) =>
    `${v.brand} ${v.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="LOCAL CONTEXT, LESS FRICTION"
        title="Your cigarette library."
        description="Philippine brands and your own entries. For accurate records, never endorsements."
        action={
          <button className="button secondary" onClick={() => setCustom(true)}>
            <Plus size={18} />
            Custom brand
          </button>
        }
      />
      <div className="notice">
        <Info size={18} />
        <span>
          This is a proposed seed catalog. Current retail variants require
          verification before release. No brand is presented as safer than
          another.
        </span>
      </div>
      <label className="search-box library-search">
        <Search size={18} />
        <input
          aria-label="Search brands"
          placeholder="Search brands and variants…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="library-grid">
        {variants.map((v) => (
          <section
            className={`card brand-card ${p.favoriteId === v.id ? "favorite" : ""}`}
            key={v.id}
          >
            <div className="brand-card-top">
              <span className="brand-monogram">{v.brand[0]}</span>
              {v.custom ? (
                <span className="pill subdued">Custom</span>
              ) : (
                <span className="pill subdued">Seed catalog</span>
              )}
            </div>
            <h2>{v.brand}</h2>
            <p>{v.name}</p>
            <button
              className={`button ${p.favoriteId === v.id ? "primary" : "secondary"} full`}
              onClick={() => {
                if (!p.onboarded) {
                  openOnboarding();
                  return;
                }
                void perform(
                  () => savePreferences({ ...p, favoriteId: v.id }),
                  `${v.brand} · ${v.name} set as your favorite.`,
                );
              }}
            >
              {p.favoriteId === v.id ? (
                <>
                  <Check size={16} />
                  Your favorite
                </>
              ) : (
                <>
                  <Heart size={16} />
                  Set as favorite
                </>
              )}
            </button>
          </section>
        ))}
      </div>
      {!variants.length && (
        <Empty title="No matching brands.">
          Try another search or add a custom entry.
        </Empty>
      )}
      {custom && (
        <Modal
          open
          title="Add your own entry"
          description="A brand and variant for your personal diary."
          onClose={() => setCustom(false)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const cleanBrand = brand.trim();
              const cleanVariant = variant.trim();
              if (!cleanBrand || !cleanVariant) return;
              const ok = await perform(
                () =>
                  db.variants.add({
                    id: crypto.randomUUID(),
                    brand: cleanBrand,
                    name: cleanVariant,
                    custom: true,
                  }),
                "Custom brand saved.",
              );
              if (ok) {
                setCustom(false);
                setBrand("");
                setVariant("");
              }
            }}
          >
            <Field label="Brand name">
              <input
                required
                maxLength={80}
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </Field>
            <Field label="Variant">
              <input
                required
                maxLength={80}
                value={variant}
                onChange={(e) => setVariant(e.target.value)}
              />
            </Field>
            <p className="fine-print">
              Set your price and pack size in Settings after choosing this entry
              as your favorite.
            </p>
            <button className="button primary">
              <Plus size={18} />
              Add to my library
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

export function SettingsPage() {
  const {
    preferences: p,
    logs,
    checkins,
    measurements,
    customVariants,
    cravings,
    perform,
    toast,
    install,
    openOnboarding,
  } = useApp();
  const [form, setForm] = useState<Preferences>({ ...p });
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const variants = [...catalog, ...customVariants];
  function download(format: "json" | "csv") {
    let content: string;
    if (format === "json")
      content = JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          preferences: p,
          logs,
          checkins,
          measurements,
          customVariants,
          cravings,
        },
        null,
        2,
      );
    else {
      const columns = [
        "id",
        "brand",
        "variant",
        "quantity",
        "smokedAt",
        "priceSnapshot",
        "trigger",
        "mood",
        "location",
        "notes",
      ] as const;
      const escape = (value: unknown) => {
        let text = String(value ?? "");
        if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      };
      content = [
        columns.join(","),
        ...activeLogs(logs).map((log) =>
          columns.map((c) => escape(log[c])).join(","),
        ),
      ].join("\r\n");
    }
    const url = URL.createObjectURL(
      new Blob([content], {
        type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `baga-diary-${new Date().toISOString().slice(0, 10)}.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Export downloaded. Keep it somewhere private.");
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR SPACE, YOUR CHOICE"
        title="Make yourself at home."
        description="Personalize your diary and stay in control of your data."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!p.onboarded) {
            openOnboarding();
            return;
          }
          await perform(
            () => savePreferences(form).then((saved) => setForm(saved)),
            "Your settings are saved.",
          );
        }}
      >
        <div className="two-column settings-grid">
          <section className="card">
            <CardTitle title="The everyday essentials" />
            <div className="form-stack">
              <Field label="First name (optional)">
                <input
                  maxLength={40}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </Field>
              <Field
                label="Timezone"
                hint="Changing timezone regroups logs by their original timestamps. Check-ins remain on the date you confirmed."
              >
                <select
                  value={form.timezone}
                  onChange={(e) => update("timezone", e.target.value)}
                >
                  {[
                    ...new Set([
                      form.timezone,
                      "Asia/Manila",
                      "Asia/Shanghai",
                      "Asia/Tokyo",
                      "Asia/Singapore",
                      "Australia/Sydney",
                      "Europe/London",
                      "America/New_York",
                      "America/Los_Angeles",
                      "UTC",
                    ]),
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Favorite brand & variant">
                <select
                  value={form.favoriteId}
                  onChange={(e) => update("favoriteId", e.target.value)}
                >
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.brand} · {v.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Current price (PHP)">
                  <input
                    type="number"
                    min="0"
                    max="10000"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => update("price", Number(e.target.value))}
                  />
                </Field>
                <Field label="Price is for">
                  <select
                    value={form.priceUnit}
                    onChange={(e) =>
                      update("priceUnit", e.target.value as "stick" | "pack")
                    }
                  >
                    <option value="stick">One stick</option>
                    <option value="pack">One pack</option>
                  </select>
                </Field>
              </div>
              <Field label="Sticks per pack">
                <input
                  required
                  type="number"
                  min="1"
                  max="100"
                  value={form.packSize}
                  onChange={(e) => update("packSize", Number(e.target.value))}
                />
              </Field>
              <small className="muted">
                Historical record prices remain unchanged.
              </small>
            </div>
          </section>
          <section className="card">
            <CardTitle title="A space that feels like you" />
            <div className="form-stack">
              <Field label="Theme">
                <select
                  value={form.theme}
                  onChange={(e) =>
                    update("theme", e.target.value as typeof form.theme)
                  }
                >
                  <option value="dark">Dark · quiet and focused</option>
                  <option value="light">Light · a brighter perspective</option>
                </select>
              </Field>
              {(
                [
                  [
                    "animation",
                    "Gentle animations",
                    "Always respects device reduced-motion settings.",
                  ],
                  [
                    "showSpending",
                    "Spending card",
                    "Show peso totals on your overview.",
                  ],
                ] as const
              ).map(([key, title, desc]) => (
                <label className="toggle-row" key={key}>
                  <div>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </div>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={form[key]}
                    onChange={(e) => update(key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
        <div className="settings-save">
          <button className="button primary">
            <Check size={18} />
            Save preferences
          </button>
        </div>
      </form>
      <NotificationSettings />
      <section className="card app-notification-settings">
        <CardTitle
          title="Device diagnostics"
          subtitle="Only error codes and timestamps. No private diary content."
        />
        <p className="settings-copy">
          BAGA keeps up to 25 technical error events on this device. Nothing is
          sent automatically. You can download this small report when
          troubleshooting; clearing local data removes it.
        </p>
        <button
          className="button secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([exportDiagnostics()], { type: "application/json" }),
            );
            const link = document.createElement("a");
            link.href = url;
            link.download = "baga-diagnostics.json";
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            toast(
              "Device diagnostics downloaded. No diary content was included.",
            );
          }}
        >
          Download device diagnostics
        </button>
      </section>

      <div className="two-column">
        <section className="card">
          <CardTitle
            title="Private by default"
            action={<ShieldCheck size={21} />}
          />
          <p className="settings-copy">
            Your cigarette diary and measurements live in this browser’s
            IndexedDB. No account is needed. Records are uploaded only after you
            enable optional cloud sync in Account & sync. BAGA sends no
            analytics.
          </p>
          <p className="settings-copy">
            Local data is not encrypted by the app. People sharing this browser
            may access it. Clearing browser data or losing this device may
            remove your diary.
          </p>
          <div className="privacy-status">
            <span className="status-dot" />
            Local diary · Optional sync in Account & sync
          </div>
          <div className="export-actions">
            <button
              className="button secondary"
              onClick={() => download("json")}
            >
              <Download size={16} />
              Export JSON
            </button>
            <button
              className="button secondary"
              onClick={() => download("csv")}
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>
          <BackupRestore />
        </section>
        <section className="card">
          <CardTitle title="Keep BAGA close" action={<Download size={21} />} />
          <p className="settings-copy">
            A little less friction in your everyday. Add BAGA to your home
            screen and take your offline diary with you.
          </p>
          <button className="button secondary" onClick={install}>
            <Plus size={17} />
            Install BAGA
          </button>
          <div className="storage-request">
            <button
              className="text-link"
              onClick={async () => {
                const granted = await navigator.storage?.persist?.();
                toast(
                  granted
                    ? "Persistent storage granted. Still export regular backups."
                    : "Persistent storage was not granted. Export a backup to protect your diary.",
                );
              }}
            >
              Request persistent device storage
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
      </div>
      <section className="card danger-zone">
        <div>
          <h2>A clean slate</h2>
          <p>
            Delete all diary records, measurements, custom brands, and
            preferences from this browser.
          </p>
        </div>
        <button className="button danger" onClick={() => setDeleting(true)}>
          <Trash2 size={16} />
          Clear local data
        </button>
      </section>
      {deleting && (
        <Modal
          open
          title="Clear this device’s BAGA data?"
          description="This permanently removes your local diary. Export a backup first."
          onClose={() => setDeleting(false)}
        >
          <div className="form-stack">
            <Field label="Type DELETE to confirm">
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <button
              className="button danger"
              disabled={deleteText !== "DELETE"}
              onClick={async () => {
                if (
                  await perform(
                    eraseData,
                    "All local BAGA records have been deleted.",
                  )
                ) {
                  setDeleting(false);
                  setForm({ ...p, onboarded: false });
                  window.location.assign("/");
                }
              }}
            >
              <Trash2 size={18} />
              Permanently delete local data
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
