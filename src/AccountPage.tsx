import { useState, useSyncExternalStore } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Cloud, CloudOff, RefreshCw, ShieldCheck } from "lucide-react";
import { db } from "./db";
import {
  cloudConfigured,
  deleteCloudAccount,
  getSession,
  signIn,
  signOut,
  signUp,
  subscribeSession,
} from "./cloud";
import {
  enableSync,
  pauseSync,
  pendingChanges,
  resolveConflict,
  localRows,
} from "./sync";
import { snapshot } from "./records";
import {
  getSyncStatus,
  runCloudSync,
  subscribeSyncStatus,
} from "./CloudAutoSync";
import { CardTitle, Field, Modal, PageTitle } from "./ui";
import type { SyncConflict } from "./sync-types";
import { PushSettings } from "./PushSettings";
import { disablePush } from "./push";

export function AccountPage() {
  const session = useSyncExternalStore(subscribeSession, getSession);
  const sync = useSyncExternalStore(subscribeSyncStatus, getSyncStatus);
  const meta = useLiveQuery(() => db.cloudMeta.get("account"));
  const conflicts =
    useLiveQuery(async () => {
      const rows = await localRows();
      return (await db.syncConflicts.toArray()).map((conflict) => ({
        ...conflict,
        local: rows.get(conflict.key)?.payload ?? null,
      }));
    }) || [];
  const pending = useLiveQuery(pendingChanges);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [review, setReview] = useState<SyncConflict | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const connected = Boolean(
    session && meta?.enabled && meta.userId === session.user.id,
  );
  async function act(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "This request could not finish. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageTitle
        eyebrow="YOUR DIARY, YOUR CHOICE"
        title="A little continuity."
        description="Keep tracking on this device, or choose a private cloud account for your other devices."
      />
      <div className="two-column">
        <section className="card">
          <CardTitle
            title={session ? "Your account" : "Optional account"}
            action={<Cloud size={22} />}
          />
          {!cloudConfigured ? (
            <p className="settings-copy">
              Cloud accounts aren’t available on this installation yet. Your
              complete diary works offline, and you can export or restore a
              private backup in Settings.
            </p>
          ) : session ? (
            <>
              <p className="settings-copy">
                Signed in as{" "}
                <strong>{session.user.email || "your account"}</strong>. Sign-in
                is stored for this browser tab. Sign out when you finish on a
                shared device.
              </p>
              <div className="form-stack">
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I agree to upload my diary, measurements, cravings, custom
                  brands, and preferences to my account for cross-device sync.
                </label>
                <button
                  className="button primary"
                  disabled={busy || connected || !consent}
                  onClick={() =>
                    void act(async () => {
                      await enableSync(session.user.id);
                      await runCloudSync(session.user.id);
                    })
                  }
                >
                  {connected ? "Cloud sync enabled" : "Enable cloud sync"}
                </button>
                {connected && (
                  <button
                    className="button secondary"
                    disabled={busy || sync.busy}
                    onClick={() => void act(pauseSync)}
                  >
                    <CloudOff size={17} />
                    Pause uploads
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={busy || sync.busy}
                  onClick={() =>
                    void act(async () => {
                      await pauseSync();
                      try {
                        await disablePush();
                      } catch {
                        /* Browser unsubscribe still stops this device's delivery. */
                      }
                      try {
                        await signOut();
                      } catch {
                        setMessage(
                          "Signed out on this device. Cloud session revocation could not finish while offline.",
                        );
                      }
                      setConsent(false);
                    })
                  }
                >
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void act(async () => {
                  if (creating) {
                    const ready = await signUp(email, password);
                    setMessage(
                      ready
                        ? "Account created. Choose whether to enable cloud sync below."
                        : "Check your email to confirm your account, then return here to sign in.",
                    );
                  } else await signIn(email, password);
                  setPassword("");
                });
              }}
            >
              <p className="settings-copy">
                Signing in does not upload your diary. You decide when to enable
                cloud synchronization.
              </p>
              <Field label="Email address">
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field
                label="Password"
                hint={creating ? "Use at least 12 characters." : undefined}
              >
                <input
                  type="password"
                  autoComplete={creating ? "new-password" : "current-password"}
                  required
                  minLength={creating ? 12 : 1}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <button className="button primary" disabled={busy}>
                {busy
                  ? "Please wait…"
                  : creating
                    ? "Create account"
                    : "Sign in"}
              </button>
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  setCreating(!creating);
                  setMessage("");
                }}
              >
                {creating
                  ? "Already have an account? Sign in"
                  : "Create an optional account"}
              </button>
            </form>
          )}
        </section>
        <section className="card">
          <CardTitle title="Sync status" action={<RefreshCw size={22} />} />
          <dl className="sync-summary">
            <div>
              <dt>Status</dt>
              <dd>
                {sync.busy
                  ? "Syncing…"
                  : connected
                    ? "Enabled"
                    : "Local diary · uploads paused"}
              </dd>
            </div>
            <div>
              <dt>Pending changes</dt>
              <dd>{pending ?? "—"}</dd>
            </div>
            <div>
              <dt>Needs review</dt>
              <dd>{conflicts.length}</dd>
            </div>
            <div>
              <dt>Last completed sync</dt>
              <dd>
                {meta?.lastSync
                  ? new Date(meta.lastSync).toLocaleString()
                  : "Not yet"}
              </dd>
            </div>
          </dl>
          <p className="settings-copy">
            New entries save on this device first. Sync resumes while BAGA is
            open and online. Closing the app never discards pending changes.
          </p>
          <button
            className="button secondary"
            disabled={!connected || busy || sync.busy}
            onClick={() => session && void runCloudSync(session.user.id)}
          >
            <RefreshCw size={17} />
            Sync now
          </button>
          {sync.error && (
            <p className="inline-notice" role="alert">
              {sync.error}
            </p>
          )}
        </section>
      </div>
      <PushSettings signedIn={Boolean(session)} />
      {message && (
        <p className="inline-notice" role="status">
          {message}
        </p>
      )}
      {conflicts.length > 0 && (
        <section className="card">
          <CardTitle
            title="Choose the version to keep"
            subtitle="Both versions remain available until you review them. No silent overwrites."
          />
          {conflicts.map((conflict) => (
            <div className="conflict-row" key={conflict.key}>
              <span>
                {conflict.remote.kind} · {conflict.remote.record_id}
              </span>
              <button
                className="button secondary"
                disabled={!connected}
                onClick={() => setReview(conflict)}
              >
                Review versions
              </button>
            </div>
          ))}
        </section>
      )}
      <section className="card">
        <CardTitle
          title="Private records, clear choices"
          action={<ShieldCheck size={22} />}
        />
        <p className="settings-copy">
          Local records are not encrypted by BAGA. When you enable sync, your
          records are sent over HTTPS to the configured cloud provider and
          isolated to your account. BAGA sends no analytics. Pausing uploads or
          signing out keeps your local diary and existing cloud records.
        </p>
        <p className="settings-copy">
          This device’s diary stays linked to its original account. To use
          another account here, export your backup and clear local data first.
        </p>
      </section>
      {session && (
        <section className="card danger-zone">
          <div>
            <h2>Delete cloud account</h2>
            <p>
              Remove your account and every cloud record. Your local diary stays
              on this device.
            </p>
          </div>
          <button
            className="button danger"
            disabled={busy || sync.busy}
            onClick={() => setDeleting(true)}
          >
            Delete cloud account
          </button>
        </section>
      )}
      {review && (
        <Modal
          open
          title="Review conflicting versions"
          description="Choose the complete record to keep. A deleted record is shown as removed."
          onClose={() => setReview(null)}
        >
          <div className="conflict-versions">
            <section>
              <h3>This device</h3>
              <pre>{JSON.stringify(review.local, null, 2) || "Removed"}</pre>
            </section>
            <section>
              <h3>Cloud version</h3>
              <pre>
                {review.remote.payload === null
                  ? "Removed"
                  : JSON.stringify(review.remote.payload, null, 2)}
              </pre>
            </section>
          </div>
          <div className="export-actions">
            {(["local", "cloud"] as const).map((choice) => (
              <button
                className="button secondary"
                key={choice}
                disabled={busy}
                onClick={() =>
                  session &&
                  void act(async () => {
                    await resolveConflict(review.key, choice, session.user.id, {
                      localSnapshot: snapshot(review.local),
                      remoteRevision: review.remote.revision,
                    });
                    setReview(null);
                    await runCloudSync(session.user.id);
                  })
                }
              >
                {choice === "local"
                  ? "Keep this device’s version"
                  : "Use cloud version"}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          open
          title="Delete your cloud account?"
          description="This permanently deletes the account, uploaded records, and synchronization history. Export a backup first. Local records are kept."
          onClose={() => setDeleting(false)}
        >
          <div className="form-stack">
            <Field label="Type DELETE CLOUD to confirm">
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <button
              className="button danger"
              disabled={confirmation !== "DELETE CLOUD" || busy || sync.busy}
              onClick={() =>
                void act(async () => {
                  await pauseSync();
                  await deleteCloudAccount();
                  setDeleting(false);
                  setMessage(
                    "Cloud account and uploaded records deleted. Your local diary is still available.",
                  );
                })
              }
            >
              Permanently delete cloud account
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
