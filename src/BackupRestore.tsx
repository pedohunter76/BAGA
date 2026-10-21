import { useState } from "react";
import { Upload } from "lucide-react";
import { parseBackup, restoreBackup, type Backup } from "./backup";
import { useApp } from "./context";
import { Field, Modal } from "./ui";
export function BackupRestore() {
  const { perform } = useApp();
  const [backup, setBackup] = useState<Backup | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="restore-backup">
      <label className="button secondary">
        <Upload size={16} />
        Restore JSON backup
        <input
          className="sr-only"
          type="file"
          accept=".json,application/json"
          aria-label="Restore JSON backup"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            setError("");
            if (!file) return;
            try {
              if (file.size > 10 * 1024 * 1024)
                throw new Error("Choose a backup smaller than 10 MB.");
              setBackup(parseBackup(await file.text()));
              setMode("merge");
              setConfirmation("");
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Could not read this backup.",
              );
            }
          }}
        />
      </label>
      {error && (
        <p role="alert" className="inline-notice">
          {error}
        </p>
      )}
      {backup && (
        <Modal
          open
          title="Restore your private backup"
          description="The file was checked. Nothing changes until you confirm. Account credentials are never imported."
          onClose={() => {
            if (!busy) setBackup(null);
          }}
        >
          <div className="form-stack">
            <p>
              Backup from {new Date(backup.exportedAt).toLocaleDateString()}:{" "}
              {backup.logs.length} cigarette records, {backup.checkins.length}{" "}
              check-ins, {backup.cravings.length} cravings, and{" "}
              {backup.measurements.length} measurements, and{" "}
              {backup.finances?.length ?? 0} financial transactions.
            </p>
            <Field label="Restore mode">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="merge">
                  Merge new records · keep current preferences
                </option>
                <option value="replace">
                  Replace local data and preferences
                </option>
              </select>
            </Field>
            <p className="settings-copy">
              Merging never overwrites a different existing record. Budget
              settings and financial transactions stay on this device. If cloud
              sync is enabled, imported diary changes will be uploaded and
              conflicts will need review.
            </p>
            {mode === "replace" && (
              <Field
                label="Type REPLACE to confirm"
                hint="Export your current diary first. Replacing removes local records absent from the backup."
              >
                <input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  autoComplete="off"
                />
              </Field>
            )}
            <button
              className="button primary"
              disabled={
                busy || (mode === "replace" && confirmation !== "REPLACE")
              }
              onClick={async () => {
                setBusy(true);
                if (
                  await perform(
                    () => restoreBackup(backup, mode),
                    "Backup restored on this device.",
                  )
                )
                  setBackup(null);
                setBusy(false);
              }}
            >
              Restore backup
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
