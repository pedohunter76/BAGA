import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell } from "lucide-react";
import { useApp } from "./context";
import { CardTitle, Field } from "./ui";
import {
  defaultNotificationSettings,
  readNotificationSettings,
  saveNotificationSettings,
  claimNotification,
  showSystemAlert,
} from "./notifications";
import { milestones } from "./progress";
import { dayKey } from "./domain";
export function NotificationSettings() {
  const { preferences: p, logs, checkins, now, perform, toast } = useApp();
  const saved = useLiveQuery(readNotificationSettings, []);
  const [form, setForm] = useState(defaultNotificationSettings);
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  useEffect(() => {
    if (saved) setForm(saved);
  }, [saved]);
  useEffect(() => {
    const refresh = () =>
      setPermission(
        "Notification" in window ? Notification.permission : "unsupported",
      );
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return (
    <section className="card app-notification-settings">
      <CardTitle
        title="App notifications"
        subtitle="Gentle reminders, without an account."
        action={<Bell size={22} />}
      />
      <p className="settings-copy">
        Daily check-ins, Sunday reviews, and progress milestones appear in your
        private inbox. Optional system alerts use neutral wording with no
        cigarette counts or health details.
      </p>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const baseline =
            !saved?.enabled && form.enabled
              ? milestones(logs, checkins, p, dayKey(now, p.timezone))
                  .filter((row) => row.unlocked)
                  .map((row) => row.id)
              : form.baseline;
          await perform(
            () => saveNotificationSettings({ ...form, baseline }),
            "Notification preferences saved on this device.",
          );
          setBusy(false);
        }}
      >
        {(
          [
            ["enabled", "Enable app notifications"],
            ["daily", "Daily check-in reminder"],
            ["weekly", "Weekly review · Sundays"],
            ["milestones", "New progress milestones"],
          ] as const
        ).map(([key, label]) => (
          <label className="toggle-row" key={key}>
            <div>
              <strong>{label}</strong>
            </div>
            <input
              type="checkbox"
              role="switch"
              checked={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
            />
          </label>
        ))}
        <Field label={`Notification delivery time · ${p.timezone}`}>
          <input
            type="time"
            required
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </Field>
        <div className="form-grid">
          <Field label="App quiet hours start">
            <input
              type="time"
              required
              value={form.quietStart}
              onChange={(e) => setForm({ ...form, quietStart: e.target.value })}
            />
          </Field>
          <Field label="App quiet hours end">
            <input
              type="time"
              required
              value={form.quietEnd}
              onChange={(e) => setForm({ ...form, quietEnd: e.target.value })}
            />
          </Field>
        </div>
        <label className="toggle-row">
          <div>
            <strong>Use permitted system alerts</strong>
            <small>
              Permission: {permission}. Inbox notifications always remain
              available.
            </small>
          </div>
          <input
            type="checkbox"
            role="switch"
            checked={form.system}
            onChange={(e) => setForm({ ...form, system: e.target.checked })}
          />
        </label>
        <p className="settings-copy">
          Scheduled reminders run while BAGA is open. A browser cannot reliably
          schedule local notifications after the app closes. Equal quiet-hour
          times turn quiet hours off. Missed reminders older than one hour are
          skipped.
        </p>
        <div className="export-actions">
          <button className="button primary" disabled={busy}>
            Save notification preferences
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={async () => {
              try {
                if (!("Notification" in window) || !window.isSecureContext) {
                  toast(
                    "System alerts aren’t supported here. Your inbox still works.",
                  );
                  return;
                }
                const reg = await navigator.serviceWorker?.getRegistration();
                if (!reg?.active) {
                  toast(
                    "Open the installed or production app before enabling system alerts.",
                  );
                  return;
                }
                const result = await Notification.requestPermission();
                setPermission(result);
                setForm((current) => ({
                  ...current,
                  system: result === "granted",
                }));
                toast(
                  result === "granted"
                    ? "System alerts permitted. Save notification preferences to enable them."
                    : "System alerts weren’t permitted. Use your inbox or change permission in browser settings.",
                );
              } catch {
                toast(
                  "System alerts could not be enabled. Your inbox still works.",
                );
              }
            }}
          >
            Enable discreet system alerts
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              void perform(async () => {
                const row = {
                  id: `test:${crypto.randomUUID()}`,
                  category: "test" as const,
                  view: "home" as const,
                  createdAt: new Date().toISOString(),
                  readAt: null,
                  title: "A moment for yourself",
                  body: "Your private space is ready whenever you are.",
                };
                await claimNotification(row);
                if (saved?.enabled && saved.system) await showSystemAlert(row);
              }, "Test notification added to your inbox.")
            }
          >
            Send test notification
          </button>
        </div>
      </form>
    </section>
  );
}
