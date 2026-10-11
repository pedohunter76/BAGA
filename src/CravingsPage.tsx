import { useState } from "react";
import { Plus, Pencil, Trash2, Wind } from "lucide-react";
import { db } from "./db";
import { recordSchemas } from "./records";
import {
  dayKey,
  formatTime,
  fromLocalDateTime,
  localDateTime,
  triggers,
  type Craving,
} from "./domain";
import { useApp } from "./context";
import { CardTitle, Empty, Field, Modal, PageTitle } from "./ui";

export function CravingsPage() {
  const { cravings, preferences: p, now, perform } = useApp();
  const [editing, setEditing] = useState<Craving | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    intensity: 3,
    trigger: "Stress",
    notes: "",
    coping: "",
    outcome: "ongoing" as "ongoing" | "passed" | "smoked",
    at: localDateTime(now.toISOString(), p.timezone),
  });
  const [busy, setBusy] = useState(false);
  function show(row?: Craving) {
    setEditing(row || null);
    setForm({
      intensity: row?.intensity || 3,
      trigger: row?.trigger || "Stress",
      notes: row?.notes || "",
      coping: row?.coping || "",
      outcome: row?.outcome || "ongoing",
      at: localDateTime(row?.at || new Date().toISOString(), p.timezone),
    });
    setOpen(true);
  }
  const rows = [...cravings].sort((a, b) => b.at.localeCompare(a.at));
  const today = rows.filter(
    (row) => dayKey(row.at, p.timezone) === dayKey(now, p.timezone),
  );
  return (
    <>
      <PageTitle
        eyebrow="MAKE ROOM FOR THE MOMENT"
        title="Notice the urge."
        description="Record a craving, its trigger, and what helped. A craving entry never adds a cigarette to your diary."
        action={
          <button className="button primary" onClick={() => show()}>
            <Plus size={18} />
            Log a craving
          </button>
        }
      />
      <div className="stats-grid">
        <section className="card metric-card">
          <Wind size={22} />
          <span>Cravings today</span>
          <strong>{today.length}</strong>
          <p>Only the moments you chose to record.</p>
        </section>
        <section className="card metric-card">
          <span>Passed without smoking</span>
          <strong>
            {today.filter((row) => row.outcome === "passed").length}
          </strong>
          <p>Based on your own outcome entries.</p>
        </section>
        <section className="card metric-card">
          <span>Average intensity today</span>
          <strong>
            {today.length
              ? (
                  today.reduce((n, row) => n + row.intensity, 0) / today.length
                ).toFixed(1)
              : "—"}
          </strong>
          <p>Your rating, from 1 to 5.</p>
        </section>
      </div>
      <section className="card">
        <CardTitle
          title="Your craving journal"
          subtitle="Private context for understanding your habits."
        />
        {rows.length ? (
          <div className="craving-list">
            {rows.map((row) => (
              <article className="craving-row" key={row.id}>
                <div>
                  <div className="craving-title">
                    <strong>{row.trigger}</strong>
                    <span className="pill">Intensity {row.intensity}/5</span>
                  </div>
                  <p className="muted">
                    {dayKey(row.at, p.timezone)} ·{" "}
                    {formatTime(row.at, p.timezone)} ·{" "}
                    {row.outcome === "passed"
                      ? "Passed without smoking"
                      : row.outcome === "smoked"
                        ? "Smoked afterwards"
                        : "Outcome not yet recorded"}
                  </p>
                  {row.coping && <p>What helped: {row.coping}</p>}
                  {row.notes && <p className="preserve-lines">{row.notes}</p>}
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label="Edit craving"
                    onClick={() => show(row)}
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Delete craving"
                    onClick={() =>
                      void perform(
                        () => db.cravings.delete(row.id),
                        "Craving removed.",
                        () => db.cravings.put(row),
                      )
                    }
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="One moment at a time.">
            Log a craving when you want to notice what brought it on, or return
            later to record what helped.
          </Empty>
        )}
      </section>
      {open && (
        <Modal
          open
          title={editing ? "Edit craving" : "Log a craving"}
          description="Your feelings are useful context. There’s no right score or required outcome."
          onClose={() => {
            if (!busy) setOpen(false);
          }}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (
                await perform(async () => {
                  const at = fromLocalDateTime(form.at, p.timezone);
                  if (Date.parse(at) > Date.now() + 60000)
                    throw new Error(
                      "Cravings cannot be recorded in the future.",
                    );
                  const row = recordSchemas.cravings.parse({
                    ...form,
                    at,
                    id: editing?.id || crypto.randomUUID(),
                  });
                  await db.cravings.put(row);
                }, "Craving saved on this device.")
              )
                setOpen(false);
              setBusy(false);
            }}
          >
            <Field label="Date and time">
              <input
                type="datetime-local"
                required
                value={form.at}
                onChange={(e) => setForm({ ...form, at: e.target.value })}
              />
            </Field>
            <Field
              label={`Intensity: ${form.intensity} out of 5`}
              hint="1 is mild · 5 is strong"
            >
              <input
                type="range"
                min={1}
                max={5}
                value={form.intensity}
                onChange={(e) =>
                  setForm({ ...form, intensity: Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Trigger">
              <select
                value={form.trigger}
                onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              >
                {triggers.map((trigger) => (
                  <option key={trigger}>{trigger}</option>
                ))}
              </select>
            </Field>
            <Field label="What helped? (optional)">
              <input
                value={form.coping}
                maxLength={100}
                placeholder="A short walk, water, talking to a friend…"
                onChange={(e) => setForm({ ...form, coping: e.target.value })}
              />
            </Field>
            <Field label="Outcome">
              <select
                value={form.outcome}
                onChange={(e) =>
                  setForm({
                    ...form,
                    outcome: e.target.value as typeof form.outcome,
                  })
                }
              >
                <option value="ongoing">Still noticing the urge</option>
                <option value="passed">Passed without smoking</option>
                <option value="smoked">Smoked afterwards</option>
              </select>
            </Field>
            <Field label="Notes (optional)">
              <textarea
                rows={3}
                maxLength={1000}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            <button className="button primary" disabled={busy}>
              Save craving
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
