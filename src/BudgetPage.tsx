import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Download,
  Wallet,
  ArrowUpRight,
  Trash2,
} from "lucide-react";
import { db } from "./db";
import { useApp } from "./context";
import { budgetSchema, type BudgetSettings } from "./budget";
import { dayKey, money } from "./domain";
import {
  expenseCategories,
  incomeCategories,
  financeSummary,
  financeCSV,
  ledgerEntries,
  type FinanceTransaction,
} from "./finance";
import { saveFinance, deleteFinance, undoDeleteFinance } from "./finance-db";
import { CardTitle, Empty, Field, Modal, PageTitle } from "./ui";

type Editor = { type: "income" | "expense"; row?: FinanceTransaction };
export function BudgetPage() {
  const {
    logs,
    finances,
    budget: saved,
    preferences: p,
    perform,
    navigate,
  } = useApp();
  const today = dayKey(new Date(), p.timezone);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [editor, setEditor] = useState<Editor | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [visible, setVisible] = useState(20);
  const [draft, setDraft] = useState<Partial<BudgetSettings> | null>(null);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState(expenseCategories[0]);
  const [categoryLimit, setCategoryLimit] = useState("");
  const settings = saved ?? null;
  const form: BudgetSettings = { monthlyLimit: 0, ...saved, ...draft };
  const entries = useMemo(
    () =>
      ledgerEntries(
        finances,
        logs,
        p.timezone,
        saved?.includeCigarettes !== false,
      ),
    [finances, logs, p.timezone, saved?.includeCigarettes],
  );
  const summary = financeSummary(
    entries,
    settings,
    month,
    new Date(),
    p.timezone,
  );
  const categories = [
    ...new Set([
      ...expenseCategories,
      ...incomeCategories,
      ...entries.map((row) => row.category),
    ]),
  ];
  const rows = summary.entries
    .filter(
      (row) =>
        (filter === "all" || row.type === filter) &&
        (!categoryFilter || row.category === categoryFilter) &&
        `${row.description} ${row.category}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.updatedAt.localeCompare(a.updatedAt) ||
        a.id.localeCompare(b.id),
    );
  const update = (value: Partial<BudgetSettings>) =>
    setDraft({ ...draft, ...value });
  const unpriced =
    saved?.includeCigarettes !== false
      ? logs.filter(
          (row) =>
            !row.deletedAt &&
            row.priceSnapshot === 0 &&
            dayKey(row.smokedAt, p.timezone).startsWith(month),
        ).length
      : 0;
  async function storeSettings(value: BudgetSettings) {
    return perform(async () => {
      await db.deviceState.put({
        id: "budget",
        data: budgetSchema.parse(value),
      });
    }, "Budget settings saved on this device.");
  }
  function exportCSV() {
    const url = URL.createObjectURL(
      new Blob([financeCSV(rows)], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `baga-finances-${month}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="finance-page">
      <PageTitle
        eyebrow="YOUR MONEY, IN ONE PLACE"
        title="Your budget."
        description="Income, everyday expenses, and savings. See the full picture and let your daily allowance adjust as you spend."
        action={
          <div className="finance-actions">
            <button
              className="button secondary"
              onClick={() => setEditor({ type: "income" })}
            >
              <Plus size={18} /> Add income
            </button>
            <button
              className="button primary"
              onClick={() => setEditor({ type: "expense" })}
            >
              <Plus size={18} /> Add expense
            </button>
          </div>
        }
      />
      <div className="finance-month">
        <Field label="Budget month">
          <input
            type="month"
            value={month}
            min="1900-01"
            max={today.slice(0, 7)}
            onChange={(e) => {
              if (
                /^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(e.target.value) &&
                e.target.value <= today.slice(0, 7)
              ) {
                setMonth(e.target.value);
                setVisible(20);
              }
            }}
          />
        </Field>
        <span className="muted">PHP · {p.timezone}</span>
      </div>
      <section className="card finance-balance">
        <div className="budget-heading">
          <Wallet size={24} />
          <span>
            {summary.current ? "Recorded balance" : "Balance at month end"}
          </span>
        </div>
        <strong className="budget-balance" data-testid="finance-balance">
          {money(summary.balance)}
        </strong>
        <p>
          Opening balance + all recorded income − all recorded expenses through{" "}
          {summary.current ? today : month}. This balance carries across months.
        </p>
        <div className="finance-totals">
          <div>
            <span>Income this month</span>
            <strong data-testid="finance-income">
              {money(summary.income)}
            </strong>
          </div>
          <div>
            <span>Expenses this month</span>
            <strong data-testid="budget-spent">
              {money(summary.expenses)}
            </strong>
          </div>
          <div>
            <span>Net this month</span>
            <strong data-testid="finance-net">{money(summary.net)}</strong>
          </div>
        </div>
      </section>
      <div className="finance-two-columns">
        <section className="card budget-overview">
          <CardTitle
            title="Monthly spending plan"
            subtitle="One limit for all expense categories. Carries forward each month."
          />
          <span>
            {settings
              ? summary.remaining < 0
                ? "Over budget"
                : "Budget remaining"
              : "Set a monthly limit"}
          </span>
          <strong className="budget-balance" data-testid="budget-remaining">
            {settings ? money(summary.remaining) : "—"}
          </strong>
          <progress
            className="budget-progress"
            aria-label="Monthly budget used"
            value={settings ? summary.usage : 0}
            max={100}
          />
          <form
            className="form-stack"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              if (await storeSettings(form)) setDraft(null);
              setBusy(false);
            }}
          >
            <Field label="Monthly expense budget (PHP)">
              <input
                type="number"
                inputMode="decimal"
                min="0"
                max="10000000"
                step="0.01"
                required
                value={draft?.monthlyLimit ?? (saved ? saved.monthlyLimit : "")}
                onChange={(e) =>
                  update({ monthlyLimit: Number(e.target.value) })
                }
              />
            </Field>
            <details>
              <summary>Balance, savings & automatic expenses</summary>
              <div className="form-stack finance-settings">
                <Field
                  label="Opening balance (PHP)"
                  hint="Money you had before your earliest recorded transaction. Can be negative; enter it once, not each month."
                >
                  <input
                    type="number"
                    inputMode="decimal"
                    min="-10000000"
                    max="10000000"
                    step="0.01"
                    required
                    value={form.openingBalance ?? 0}
                    onChange={(e) =>
                      update({ openingBalance: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field
                  label="Monthly savings target (PHP)"
                  hint="Reserved from the recorded balance when calculating your daily allowance. This is a target, not a separate account or transfer."
                >
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max="10000000"
                    step="0.01"
                    required
                    value={form.savingsTarget ?? 0}
                    onChange={(e) =>
                      update({ savingsTarget: Number(e.target.value) })
                    }
                  />
                </Field>
                <label className="finance-checkbox">
                  <input
                    type="checkbox"
                    checked={form.includeCigarettes !== false}
                    onChange={(e) =>
                      update({ includeCigarettes: e.target.checked })
                    }
                  />
                  <span>Include cigarette logs as automatic expenses</span>
                </label>
                <p className="muted">
                  Automatic cigarette costs use consumption prices, not pack
                  purchases. If you record cigarette purchases manually, switch
                  this off to prevent double counting. Changing this applies to
                  every month.
                </p>
              </div>
            </details>
            <button className="button primary" disabled={busy}>
              Save budget
            </button>
          </form>
        </section>
        <section className="card">
          <CardTitle
            title="Your spending guide"
            subtitle="Updated automatically from your income and expenses."
          />
          <div className="finance-guide">
            <div className="finance-guide-metric">
              <span>Available per day for the rest of this month</span>
              <strong data-testid="finance-allowance">
                {summary.current ? money(summary.dailyAvailable) : "—"}
              </strong>
              <p>
                The lower of your unspent budget and recorded balance, after
                reserving your savings target, divided across the days remaining
                including today. Unreceived income is never counted.
              </p>
            </div>
            <div className="finance-guide-metric">
              <span>Projected month-end expenses</span>
              <strong>{money(summary.projected)}</strong>
              <p>
                Based on the calendar-day average of recorded expenses. Missing
                entries and one-off purchases affect the estimate.
              </p>
            </div>
          </div>
          {settings && summary.projected > settings.monthlyLimit && (
            <p className="notice">
              Your recorded pace is{" "}
              {money(summary.projected - settings.monthlyLimit)} over your
              spending limit.
            </p>
          )}
          {summary.balance < 0 && (
            <p className="notice">
              Your recorded expenses exceed your available funds. Add missing
              income or review expenses.
            </p>
          )}
          {(settings?.savingsTarget ?? 0) > 0 && (
            <div className="finance-savings">
              <h3>Monthly savings progress</h3>
              <p>
                {money(Math.max(0, summary.net))} net income toward{" "}
                {money(settings!.savingsTarget!)}.
              </p>
              <progress
                className="budget-progress"
                aria-label="Savings target progress"
                value={summary.savingsProgress}
                max={100}
              />
              <p className="muted">
                Based on this month’s income minus expenses; not proof of money
                set aside.
              </p>
            </div>
          )}
        </section>
      </div>
      <section className="card finance-category-section">
        <CardTitle
          title="Spending by category"
          subtitle="Set optional category limits. These divide your overall plan; they do not add to it."
        />
        <form
          className="finance-category-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            const name = category.trim();
            if (
              await storeSettings({
                ...(saved ?? { monthlyLimit: 0 }),
                categoryLimits: {
                  ...saved?.categoryLimits,
                  [name]: Number(categoryLimit),
                },
              })
            )
              setCategoryLimit("");
            setBusy(false);
          }}
        >
          <Field label="Category to budget">
            <input
              list="expense-categories"
              maxLength={60}
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </Field>
          <Field label="Category limit (PHP)">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="10000000"
              step="0.01"
              required
              value={categoryLimit}
              onChange={(e) => setCategoryLimit(e.target.value)}
            />
          </Field>
          <button className="button secondary" disabled={busy || !saved}>
            Set category limit
          </button>
        </form>
        {!saved && (
          <p className="muted">
            Save your overall monthly budget before adding category limits.
          </p>
        )}
        {saved &&
          Object.values(saved.categoryLimits ?? {}).reduce(
            (sum, value) => sum + value,
            0,
          ) > saved.monthlyLimit && (
            <p className="notice">
              Your category limits add up to more than your overall monthly
              budget.
            </p>
          )}
        <div className="finance-categories">
          {summary.categories.map((row) => (
            <article key={row.category} className="finance-category">
              <div>
                <strong>{row.category}</strong>
                <span>
                  {money(row.spent)}
                  {row.limit !== undefined
                    ? ` / ${money(row.limit)}`
                    : ` · ${row.share.toFixed(0)}% of expenses`}
                </span>
              </div>
              <progress
                className="budget-progress"
                aria-label={`${row.category} spending share`}
                max={100}
                value={
                  row.limit !== undefined
                    ? row.limit
                      ? Math.min(100, (row.spent / row.limit) * 100)
                      : row.spent
                        ? 100
                        : 0
                    : row.share
                }
              />
              {row.limit !== undefined && (
                <div className="finance-category-status">
                  <span>
                    {row.spent > row.limit
                      ? `${money(row.spent - row.limit)} over limit`
                      : `${money(row.limit - row.spent)} remaining`}
                  </span>
                  <button
                    className="button subtle"
                    disabled={busy}
                    aria-label={`Remove ${row.category} limit`}
                    onClick={async () => {
                      const next = { ...saved!.categoryLimits };
                      delete next[row.category];
                      setBusy(true);
                      await storeSettings({ ...saved!, categoryLimits: next });
                      setBusy(false);
                    }}
                  >
                    Remove limit
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
        {!summary.categories.length && (
          <p className="muted">
            Your expense categories appear here as you record spending.
          </p>
        )}
      </section>
      <section className="card finance-history-section">
        <CardTitle
          title="Income & expense history"
          subtitle="Filter, edit, or remove transactions. Automatic cigarette entries link to their original record."
          action={
            <button className="button secondary" onClick={exportCSV}>
              <Download size={16} /> Export filtered CSV
            </button>
          }
        />
        <div className="finance-filters">
          <Field label="Search transactions">
            <input
              type="search"
              value={query}
              maxLength={200}
              placeholder="Description or category"
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(20);
              }}
            />
          </Field>
          <Field label="Transaction type">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setVisible(20);
              }}
            >
              <option value="all">All transactions</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
          </Field>
          <Field label="Filter category">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setVisible(20);
              }}
            >
              <option value="">All categories</option>
              {categories.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="finance-filter-summary">
          <span>{rows.length} transactions</span>
          <span>
            Filtered income{" "}
            <strong>
              {money(
                rows
                  .filter((row) => row.type === "income")
                  .reduce((sum, row) => sum + Math.round(row.amount * 100), 0) /
                  100,
              )}
            </strong>
          </span>
          <span>
            Filtered expenses{" "}
            <strong>
              {money(
                rows
                  .filter((row) => row.type === "expense")
                  .reduce((sum, row) => sum + Math.round(row.amount * 100), 0) /
                  100,
              )}
            </strong>
          </span>
        </div>
        {rows.length ? (
          <div className="finance-history">
            {rows.slice(0, visible).map((row) => (
              <article key={row.id} className="finance-row">
                <div className="finance-row-copy">
                  <strong>{row.description || row.category}</strong>
                  <p>
                    <time dateTime={row.date}>{row.date}</time> · {row.category}{" "}
                    · {row.type === "income" ? "Income" : "Expense"}
                    {row.automatic ? " · Automatic" : ""}
                  </p>
                </div>
                <strong
                  className={
                    row.type === "income" ? "finance-income" : "finance-expense"
                  }
                >
                  {row.type === "income" ? "+" : "−"}
                  {money(row.amount)}
                </strong>
                {row.automatic ? (
                  <button
                    className="icon-button"
                    aria-label={`Open cigarette record ${row.description}`}
                    onClick={() => navigate("log")}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                ) : (
                  <button
                    className="icon-button"
                    aria-label={`Edit transaction ${row.description || row.category}`}
                    onClick={() => setEditor({ type: row.type, row })}
                  >
                    <Pencil size={18} />
                  </button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title={
              summary.entries.length
                ? "No matching transactions."
                : "Start with your income and expenses."
            }
          >
            Record salary, groceries, rent, transport, bills, or any other money
            coming in or going out.
          </Empty>
        )}
        {rows.length > visible && (
          <button
            className="button secondary"
            onClick={() => setVisible(visible + 20)}
          >
            Show more transactions
          </button>
        )}
      </section>
      {unpriced > 0 && (
        <p className="notice">
          {unpriced} cigarette entries have a zero price. Update them in
          cigarette history for accurate totals.
        </p>
      )}
      <p className="muted">
        All amounts are in PHP. Financial transactions and budget settings stay
        on this device, work offline, and are included in Settings → Export JSON
        and Restore JSON backup. They do not sync to your account or connect to
        a bank.
      </p>
      <datalist id="expense-categories">
        {expenseCategories.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {editor && (
        <TransactionEditor
          key={editor.row?.id ?? editor.type}
          editor={editor}
          today={today}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  );
}

function TransactionEditor({
  editor,
  today,
  onClose,
}: {
  editor: Editor;
  today: string;
  onClose: () => void;
}) {
  const { perform } = useApp();
  const [type, setType] = useState(editor.type);
  const [amount, setAmount] = useState(
    editor.row ? String(editor.row.amount) : "",
  );
  const [category, setCategory] = useState(
    editor.row?.category ??
      (type === "income" ? "Salary" : expenseCategories[0]),
  );
  const [date, setDate] = useState(editor.row?.date ?? today);
  const [description, setDescription] = useState(editor.row?.description ?? "");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <Modal
      open
      title={
        editor.row
          ? "Edit transaction"
          : type === "income"
            ? "Add income"
            : "Add expense"
      }
      description="Record money received or spent. Transfers between your own accounts are neither income nor expenses."
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="form-stack finance-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          const ok = await perform(async () => {
            if (date > today)
              throw new Error(
                "Choose today or an earlier date for a completed transaction.",
              );
            await saveFinance(
              { type, amount: Number(amount), category, date, description },
              editor.row,
            );
          }, "Transaction saved.");
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <Field label="Type">
          <select
            value={type}
            onChange={(e) => {
              const value = e.target.value as "income" | "expense";
              setType(value);
              setCategory(value === "income" ? "Salary" : expenseCategories[0]);
            }}
          >
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </Field>
        <Field label="Amount (PHP)">
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            max="10000000"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
        </Field>
        <Field
          label="Category"
          hint="Choose a suggestion or type your own category."
        >
          <input
            list="transaction-categories"
            maxLength={60}
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="transaction-categories">
            {(type === "income" ? incomeCategories : expenseCategories).map(
              (name) => (
                <option key={name} value={name} />
              ),
            )}
          </datalist>
        </Field>
        <Field label="Transaction date">
          <input
            type="date"
            required
            min="1900-01-01"
            max={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Description (optional)">
          <input
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              type === "income" ? "Monthly salary" : "Groceries, rent, coffee…"
            }
          />
        </Field>
        <button className="button primary" disabled={busy}>
          {editor.row ? "Save transaction changes" : "Save transaction"}
        </button>
        {editor.row && (
          <>
            {confirmDelete ? (
              <div role="group" aria-label="Confirm transaction deletion">
                <p>
                  Delete this transaction? Your totals will update immediately.
                </p>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const row = editor.row!;
                    const ok = await perform(
                      () => deleteFinance(row),
                      "Transaction removed.",
                      () => undoDeleteFinance(row),
                    );
                    setBusy(false);
                    if (ok) onClose();
                  }}
                >
                  Confirm delete transaction
                </button>
                <button
                  type="button"
                  className="button subtle"
                  disabled={busy}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep transaction
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button subtle"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} /> Delete transaction
              </button>
            )}
          </>
        )}
      </form>
    </Modal>
  );
}
