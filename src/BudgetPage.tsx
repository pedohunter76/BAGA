import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Wallet, ArrowUpRight } from "lucide-react";
import { db } from "./db";
import { useApp } from "./context";
import { budgetSchema, budgetSummary } from "./budget";
import { money } from "./domain";
import { CardTitle, Empty, Field, PageTitle } from "./ui";

export function BudgetPage() {
  const { logs, preferences: p, perform, navigate } = useApp();
  const settings = useLiveQuery(async () => {
    const parsed = budgetSchema.safeParse(
      (await db.deviceState.get("budget"))?.data,
    );
    return parsed.success ? parsed.data : null;
  });
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const limit = settings?.monthlyLimit ?? 0;
  const summary = budgetSummary(logs, new Date(), p.timezone, limit);
  const hasBudget = settings != null;
  return (
    <>
      <PageTitle
        eyebrow="MAKE SPACE FOR YOUR SAVINGS"
        title="Your budget."
        description="Cigarette spending, automatically tracked from your records. Every edit and deletion updates your balance."
      />
      <section className="card budget-overview">
        <div className="budget-heading">
          <Wallet size={24} />
          <span>
            {summary.month} · PHP · {p.timezone}
          </span>
        </div>
        <span className="stat-label">
          {!hasBudget
            ? "Your monthly budget"
            : summary.remaining < 0
              ? "Over your monthly budget"
              : "Remaining this month"}
        </span>
        <strong className="budget-balance" data-testid="budget-remaining">
          {hasBudget ? money(Math.abs(summary.remaining)) : "Set your budget"}
        </strong>
        <progress
          className="budget-progress"
          aria-label="Monthly budget used"
          value={summary.usage}
          max={100}
        />
        <p className="muted">
          {money(summary.spent)} spent{" "}
          {hasBudget ? `of ${money(limit)}` : "this month"} ·{" "}
          {summary.transactions} recorded entries
        </p>
        <form
          className="budget-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const ok = await perform(async () => {
              const data = budgetSchema.parse({
                monthlyLimit: Number(draft ?? limit),
              });
              await db.deviceState.put({ id: "budget", data });
            }, "Monthly budget saved on this device.");
            if (ok) setDraft(null);
            setBusy(false);
          }}
        >
          <Field
            label="Monthly cigarette budget (PHP)"
            hint="Your limit carries forward each month. You can change it any time."
          >
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="10000000"
              step="0.01"
              required
              value={draft ?? (hasBudget ? String(limit) : "")}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <button
            className="button primary"
            disabled={busy || settings === undefined}
          >
            Save budget
          </button>
        </form>
      </section>
      <div className="stats-grid">
        <section className="card metric-card">
          <span>Spent this month</span>
          <strong data-testid="budget-spent">{money(summary.spent)}</strong>
          <p>Uses each record’s original price.</p>
        </section>
        <section className="card metric-card">
          <span>Available for today</span>
          <strong>{hasBudget ? money(summary.todayAvailable) : "—"}</strong>
          <p>
            {hasBudget
              ? `${money(summary.dailyAllowance)} daily allowance, less ${money(summary.todaySpent)} already spent today. Rebalanced across the remaining days.`
              : "Set a limit to calculate your daily allowance."}
          </p>
        </section>
        <section className="card metric-card">
          <span>Projected month-end spending</span>
          <strong>{money(summary.projected)}</strong>
          <p>
            At your recorded pace over {summary.day} calendar days. Missing logs
            can understate this estimate.
          </p>
        </section>
      </div>
      {hasBudget && summary.projected > limit && (
        <section className="card">
          <CardTitle
            title="Your current pace is over budget"
            subtitle={`Projected spending is ${money(summary.projected - limit)} above your limit. Your remaining balance adjusts automatically as you record spending.`}
          />
        </section>
      )}
      {summary.unpriced > 0 && (
        <p className="notice">
          {summary.unpriced} entries have a zero price. Update their prices in
          cigarette history for accurate totals.
        </p>
      )}
      <section className="card">
        <CardTitle
          title="Daily spending"
          subtitle="This month, based on your profile timezone."
          action={
            <button className="button subtle" onClick={() => navigate("log")}>
              Cigarette history <ArrowUpRight size={16} />
            </button>
          }
        />
        {summary.daily.length ? (
          <div className="budget-days">
            {summary.daily.map((row) => (
              <div className="budget-day" key={row.date}>
                <time dateTime={row.date}>{row.date}</time>
                <strong>{money(row.amount)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Your spending starts here.">
            Log a cigarette with its price to see your budget update
            automatically.
          </Empty>
        )}
      </section>
      <p className="muted">
        Tracks cigarette consumption costs, not bank transactions or pack
        purchases. Budget settings stay on this device and are included in JSON
        backups; they do not sync to your account. Previous craving entries
        remain in your backups.
      </p>
    </>
  );
}
