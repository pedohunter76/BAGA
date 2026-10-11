import { useState } from "react";
import { Bell } from "lucide-react";
import { useApp } from "./context";
import { enablePush, disablePush, pushConfigured, pushSupported } from "./push";
import { CardTitle, Field } from "./ui";
export function PushSettings({ signedIn }: { signedIn: boolean }) {
  const { preferences: p } = useApp();
  const [time, setTime] = useState("20:00");
  const [start, setStart] = useState("22:00");
  const [end, setEnd] = useState("08:00");
  const [daily, setDaily] = useState(true);
  const [weekly, setWeekly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function act(action: () => Promise<void>, success: string) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update reminders.",
      );
    } finally {
      setBusy(false);
    }
  }
  const ready = pushConfigured && pushSupported() && signedIn;
  return (
    <section className="card">
      <CardTitle
        title="Discreet background reminders"
        subtitle="An optional nudge, even when BAGA is closed."
        action={<Bell size={22} />}
      />
      <p className="settings-copy">
        Messages say “A moment for yourself” and contain no cigarette counts,
        notes, measurements, or health details. Enabling reminders shares this
        device’s push subscription and schedule with your account.
      </p>
      {!ready ? (
        <p className="settings-copy">
          {!signedIn
            ? "Sign in to configure optional background reminders."
            : "Background reminders aren’t available on this installation or browser. Use in-app reminders in Settings. On supported iPhones and iPads, add BAGA to the Home Screen first."}
        </p>
      ) : (
        <div className="form-stack">
          <label className="consent">
            <input
              type="checkbox"
              checked={daily}
              onChange={(e) => setDaily(e.target.checked)}
            />
            Daily check-in reminder
          </label>
          <label className="consent">
            <input
              type="checkbox"
              checked={weekly}
              onChange={(e) => setWeekly(e.target.checked)}
            />
            Weekly review reminder · Sundays
          </label>
          <div className="two-column">
            <Field label={`Delivery time · ${p.timezone}`}>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </Field>
            <div>
              <Field label="Quiet hours start">
                <input
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </Field>
              <Field label="Quiet hours end">
                <input
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </Field>
            </div>
          </div>
          <div className="export-actions">
            <button
              className="button primary"
              disabled={busy || (!daily && !weekly)}
              onClick={() =>
                void act(
                  () =>
                    enablePush(
                      {
                        timezone: p.timezone,
                        time,
                        quietStart: start,
                        quietEnd: end,
                      },
                      [
                        ...(daily ? ["daily" as const] : []),
                        ...(weekly ? ["weekly" as const] : []),
                      ],
                    ),
                  "Reminder schedule saved. Delivery depends on your browser and push service.",
                )
              }
            >
              Enable or update reminders
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void act(
                  disablePush,
                  "Background reminders disabled on this device.",
                )
              }
            >
              Disable this device’s reminders
            </button>
          </div>
          <p className="settings-copy">
            Equal quiet-hour times disable quiet hours. Re-save the schedule
            after changing timezone. You can also revoke notification permission
            in your browser.
          </p>
        </div>
      )}
      {message && (
        <p className="inline-notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
