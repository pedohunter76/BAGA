import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ShieldCheck,
  Minus,
  Plus,
  Trash2,
  Cigarette,
  Leaf,
  Activity,
} from "lucide-react";
import { loadDraft, saveDraft } from "./onboarding";
import { Modal, Field, Logo } from "./ui";
import { useApp } from "./context";
import {
  catalog,
  perStick,
  localDateTime,
  fromLocalDateTime,
  triggers,
  money,
} from "./domain";
import type { CigaretteLog, Preferences } from "./domain";
import { savePreferences, saveLog, setDeleted } from "./db";

function ProfileFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
  open: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0 });
  }, [title]);
  return (
    <section className="profile-page">
      <header className="welcome-header">
        <Logo />
        <button className="button secondary" onClick={onClose}>
          Cancel setup
        </button>
      </header>
      <div className="profile-card">
        <p className="eyebrow">CREATE YOUR PROFILE</p>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p className="profile-step">{description}</p>
        {children}
      </div>
    </section>
  );
}

export function OnboardingDialog({
  close,
  done,
  fullPage = false,
}: {
  close: () => void;
  done: () => void;
  fullPage?: boolean;
}) {
  const { preferences: p, customVariants, perform } = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Preferences>({ ...p });
  const [busy, setBusy] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftError, setDraftError] = useState("");
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    void loadDraft()
      .then((draft) => {
        if (!active) return;
        if (draft && !p.onboarded) {
          setStep(draft.step);
          setForm({ ...draft.form, adult: false });
        }
        setDraftLoaded(true);
      })
      .catch(() => {
        if (active) {
          setDraftError(
            "Setup could not be restored. You can continue; changes may not survive closing the app.",
          );
          setDraftLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!draftLoaded || p.onboarded) return;
    writes.current = writes.current
      .then(() => saveDraft({ version: 1, step, form }))
      .then(() => setDraftError(""))
      .catch(() =>
        setDraftError(
          "Your setup draft could not be saved. Keep this page open and check browser storage.",
        ),
      );
  }, [draftLoaded, step, form, p.onboarded]);
  const variants = [...catalog, ...customVariants];
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const Frame = fullPage ? ProfileFrame : Modal;
  if (!draftLoaded) return <p role="status">Opening your profile setup…</p>;
  return (
    <Frame
      open
      title={
        step === 0
          ? "A fresh start, at your pace."
          : step === 1
            ? "Make BAGA yours."
            : "Your data. Your choice."
      }
      description={`Step ${step + 1} of 3 · No account needed`}
      onClose={() => {
        if (!busy) close();
      }}
    >
      {draftError && <p role="alert">{draftError}</p>}
      <div className="step-progress">
        {[0, 1, 2].map((s) => (
          <i key={s} className={s <= step ? "active" : ""} />
        ))}
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (step < 2) {
            setStep(step + 1);
            return;
          }
          setBusy(true);
          await writes.current;
          const ok = await perform(
            () => savePreferences({ ...form, adult: true, onboarded: true }),
            "Your preferences are saved on this device.",
          );
          setBusy(false);
          if (ok) done();
        }}
      >
        {step === 0 && (
          <>
            <div className="onboarding-brand">
              <Logo />
              <p>A little awareness goes a long way.</p>
            </div>
            <p className="form-section-label">What brings you here?</p>
            <div className="goal-options">
              {(
                [
                  [
                    "reduce",
                    Leaf,
                    "Reduce at my own pace",
                    "Choose a daily limit that works for you.",
                  ],
                  [
                    "quit",
                    Check,
                    "Work toward quitting",
                    "Mark a quit date and track smoke-free days.",
                  ],
                  [
                    "track",
                    Activity,
                    "Understand my habits",
                    "Just keep a diary. No targets needed.",
                  ],
                ] as const
              ).map(([value, Icon, title, desc]) => (
                <button
                  type="button"
                  className={`goal-option ${form.goalMode === value ? "selected" : ""}`}
                  aria-pressed={form.goalMode === value}
                  onClick={() => update("goalMode", value)}
                  key={value}
                >
                  <Icon size={21} />
                  <span>
                    <strong>{title}</strong>
                    <small>{desc}</small>
                  </span>
                  <i>{form.goalMode === value && <Check size={14} />}</i>
                </button>
              ))}
            </div>
          </>
        )}
        {step === 1 && (
          <div className="form-stack">
            <div className="profile-preview">
              <span className="profile-initial">
                {form.name.trim().charAt(0).toUpperCase() || "Y"}
              </span>
              <div>
                <strong>{form.name.trim() || "Your personal space"}</strong>
                <p>A profile just for you.</p>
              </div>
            </div>
            <Field label="What should we call you? (optional)">
              <input
                autoComplete="given-name"
                placeholder="Your first name"
                value={form.name}
                maxLength={40}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>
            <Field label="Your usual brand & variant">
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
            <small className="muted">
              Seed catalog for tracking. Retail variants need verification;
              brands are not endorsements.
            </small>
            <div className="form-grid">
              <Field label="Price (PHP)">
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
            {form.priceUnit === "pack" && (
              <Field label="Sticks per pack">
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={form.packSize}
                  onChange={(e) => update("packSize", Number(e.target.value))}
                />
              </Field>
            )}
            {form.goalMode !== "track" && (
              <Field
                label={
                  form.goalMode === "quit"
                    ? "Daily limit before your quit date"
                    : "Your daily cigarette limit"
                }
              >
                <input
                  type="number"
                  min="0"
                  max="100"
                  required
                  value={form.dailyLimit}
                  onChange={(e) => update("dailyLimit", Number(e.target.value))}
                />
              </Field>
            )}
            {form.goalMode === "quit" && (
              <Field label="Your quit date">
                <input
                  type="datetime-local"
                  required
                  value={
                    form.quitAt ? localDateTime(form.quitAt, form.timezone) : ""
                  }
                  onChange={(e) => {
                    try {
                      update(
                        "quitAt",
                        fromLocalDateTime(e.target.value, form.timezone),
                      );
                    } catch {
                      update("quitAt", "");
                    }
                  }}
                />
              </Field>
            )}
          </div>
        )}
        {step === 2 && (
          <>
            <div className="privacy-box">
              <ShieldCheck size={30} />
              <h3>Private by default.</h3>
              <p>
                Your diary and measurements are stored in this browser on this
                device. Optional cloud sync is available after setup, only with
                your consent. Export a backup when you need one.
              </p>
              <p>
                Local storage is not app-encrypted. Other people using this
                browser may access it; clearing browser data can remove your
                diary.
              </p>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                required
                checked={form.adult}
                onChange={(e) => update("adult", e.target.checked)}
              />
              <span>
                I am 18 or older and understand the local-storage privacy
                notice.
              </span>
            </label>
            <p className="fine-print">
              The lung illustration is educational. It cannot diagnose disease
              or determine lung capacity from cigarette counts.
            </p>
          </>
        )}
        <div className="modal-actions">
          {step > 0 && (
            <button
              type="button"
              className="button secondary"
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : step === 2 ? "Start my journey" : "Continue"}
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </Frame>
  );
}

export function LogDialog({
  existing,
  date: selectedDate,
  close,
}: {
  existing?: CigaretteLog;
  date?: string;
  close: () => void;
}) {
  const { preferences: p, customVariants, perform, now } = useApp();
  const variants = [...catalog, ...customVariants];
  const [variantId, setVariantId] = useState(
    existing?.variantId || p.favoriteId,
  );
  const [quantity, setQuantity] = useState(existing?.quantity || 1);
  const currentLocal = localDateTime(
    existing?.smokedAt || now.toISOString(),
    p.timezone,
  );
  const [date, setDate] = useState(
    selectedDate && selectedDate < currentLocal.slice(0, 10)
      ? `${selectedDate}T12:00`
      : currentLocal,
  );
  const [price, setPrice] = useState(existing?.priceSnapshot ?? perStick(p));
  const [trigger, setTrigger] = useState(existing?.trigger || "None");
  const [mood, setMood] = useState(existing?.mood || "");
  const [location, setLocation] = useState(existing?.location || "");
  const [notes, setNotes] = useState(existing?.notes || "");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [details, setDetails] = useState(
    Boolean(
      existing?.notes || (existing?.trigger && existing.trigger !== "None"),
    ),
  );
  const favorite = variants.find((v) => v.id === variantId);
  return (
    <Modal
      open
      title={existing ? "Edit your record" : "Log a cigarette"}
      description="An honest record. No judgment."
      onClose={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          let saved: CigaretteLog | undefined;
          const ok = await perform(
            async () => {
              if (!favorite)
                throw new Error("Choose a brand from your library.");
              saved = await saveLog(
                {
                  variantId,
                  brand: favorite.brand,
                  variant: favorite.name,
                  quantity,
                  smokedAt: fromLocalDateTime(date, p.timezone),
                  priceSnapshot: price,
                  trigger,
                  mood,
                  location,
                  notes,
                },
                existing,
              );
            },
            existing ? "Record updated." : "Saved to your diary.",
            !existing
              ? async () => {
                  if (saved) await setDeleted(saved.id, true);
                }
              : undefined,
          );
          setBusy(false);
          if (ok) close();
        }}
      >
        <div className="form-stack">
          <Field label="Brand & variant">
            <select
              value={variantId}
              onChange={(e) => setVariantId(e.target.value)}
            >
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} · {v.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="quantity-control">
            <span>Quantity</span>
            <div>
              <button
                type="button"
                className="icon-button"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
              >
                <Minus size={18} />
              </button>
              <input
                aria-label="Quantity"
                type="number"
                min="1"
                max="100"
                required
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Increase quantity"
                disabled={quantity >= 100}
                onClick={() => setQuantity(quantity + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
          <Field label={`Date & time · ${p.timezone}`}>
            <input
              type="datetime-local"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={localDateTime(new Date().toISOString(), p.timezone)}
            />
          </Field>
          <Field
            label="Price per stick (PHP)"
            hint="Saved with this record; later price changes won’t affect it."
          >
            <input
              type="number"
              min="0"
              max="10000"
              step="any"
              required
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </Field>
          <div className="record-total">
            <span>Record total</span>
            <strong>{money(quantity * price)}</strong>
          </div>
          <button
            type="button"
            className="text-link"
            onClick={() => setDetails(!details)}
          >
            {details ? "− Hide details" : "+ Add a trigger, mood or note"}
          </button>
          {details && (
            <>
              <Field label="Trigger">
                <select
                  value={trigger}
                  onChange={(e) => setTrigger(e.target.value)}
                >
                  {triggers.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <div className="form-grid">
                <Field label="Mood (optional)">
                  <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                  >
                    {["", "Calm", "Stressed", "Tired", "Happy", "Restless"].map(
                      (m) => (
                        <option key={m} value={m}>
                          {m || "Not specified"}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field label="Location (optional)">
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  >
                    {["", "Home", "Work", "Outdoors", "Social setting"].map(
                      (l) => (
                        <option key={l} value={l}>
                          {l || "Not specified"}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
              </div>
              <Field label="Notes (optional)">
                <textarea
                  maxLength={1000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything you’d like to remember…"
                />
              </Field>
            </>
          )}
        </div>
        {deleting && (
          <div className="confirm-inline">
            <p>Delete this record? Your statistics will recalculate.</p>
            <button
              type="button"
              className="button danger"
              onClick={async () => {
                if (
                  existing &&
                  (await perform(
                    () => setDeleted(existing.id, true),
                    "Record deleted.",
                    () => setDeleted(existing.id, false),
                  ))
                )
                  close();
              }}
            >
              Confirm delete
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => setDeleting(false)}
            >
              Keep record
            </button>
          </div>
        )}
        <div className="modal-actions">
          {existing && (
            <button
              type="button"
              className="icon-button danger-text"
              aria-label="Delete record"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={20} />
            </button>
          )}
          <button className="button primary" disabled={busy}>
            <Cigarette size={18} />
            {busy ? "Saving…" : existing ? "Save changes" : "Save record"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
