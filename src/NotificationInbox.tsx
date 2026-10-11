import { useLiveQuery } from "dexie-react-hooks";
import { Bell, CheckCheck } from "lucide-react";
import { db } from "./db";
import { useApp } from "./context";
import { Empty, Modal } from "./ui";
export function NotificationInbox({ close }: { close: () => void }) {
  const { navigate, perform } = useApp();
  const rows =
    useLiveQuery(
      () =>
        db.notifications.orderBy("createdAt").reverse().limit(100).toArray(),
      [],
    ) ?? [];
  return (
    <Modal
      open
      title="Your notifications"
      description="A quiet space for reminders and progress."
      onClose={close}
    >
      <div className="notification-inbox">
        <button
          className="button secondary full"
          disabled={!rows.some((row) => !row.readAt)}
          onClick={() =>
            void perform(
              () =>
                db.notifications
                  .toCollection()
                  .modify({ readAt: new Date().toISOString() }),
              "All notifications marked as read.",
            )
          }
        >
          <CheckCheck size={18} />
          Mark all as read
        </button>
        {rows.length ? (
          <ol>
            {rows.map((row) => (
              <li className={row.readAt ? "" : "unread"} key={row.id}>
                <Bell size={20} />
                <div>
                  <strong>{row.title}</strong>
                  <p>{row.body}</p>
                  <time dateTime={row.createdAt}>
                    {new Date(row.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                  <button
                    className="text-link"
                    onClick={() =>
                      void perform(async () => {
                        await db.notifications.update(row.id, {
                          readAt: new Date().toISOString(),
                        });
                        close();
                        navigate(row.view);
                      })
                    }
                  >
                    Open{" "}
                    {row.view === "home"
                      ? "overview"
                      : row.view === "goals"
                        ? "goals"
                        : "insights"}
                  </button>
                </div>
                {!row.readAt && (
                  <span className="unread-dot" role="img" aria-label="Unread" />
                )}
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="A little quiet for now.">
            Your reminders will appear here. Choose notifications in Settings
            when you’re ready.
          </Empty>
        )}
      </div>
    </Modal>
  );
}
