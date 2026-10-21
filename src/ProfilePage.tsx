import { useState, useEffect } from "react";
import {
  User,
  ShieldCheck,
  Leaf,
  Flame,
  Wind,
  Sparkles,
  Check,
  Plus,
  Minus,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { useApp } from "./context";
import { savePreferences, eraseData } from "./db";
import { catalog, perStick } from "./domain";
import type { Preferences, GoalMode } from "./domain";
import { PageTitle, CardTitle, Field } from "./ui";

const AVATAR_ICONS = [
  { id: "leaf", label: "Leaf", Icon: Leaf },
  { id: "flame", label: "Flame", Icon: Flame },
  { id: "wind", label: "Wind", Icon: Wind },
  { id: "shield", label: "Shield", Icon: ShieldCheck },
  { id: "sparkles", label: "Sparkles", Icon: Sparkles },
] as const;

const AVATAR_COLORS = [
  { id: "#bae672", label: "Lime", hex: "#bae672" },
  { id: "#f6ad55", label: "Amber", hex: "#f6ad55" },
  { id: "#63b3ed", label: "Sky", hex: "#63b3ed" },
  { id: "#b794f4", label: "Lavender", hex: "#b794f4" },
  { id: "#f687b3", label: "Rose", hex: "#f687b3" },
  { id: "#4fd1c5", label: "Teal", hex: "#4fd1c5" },
] as const;

export function ProfilePage() {
  const {
    preferences: p,
    customVariants,
    perform,
    toast,
    openOnboarding,
  } = useApp();

  const [form, setForm] = useState<Preferences>({ ...p });
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const [avatarIcon, setAvatarIcon] = useState<string>(() => {
    try {
      return localStorage.getItem("baga_profile_avatar_icon") || "leaf";
    } catch {
      return "leaf";
    }
  });

  const [avatarColor, setAvatarColor] = useState<string>(() => {
    try {
      return localStorage.getItem("baga_profile_avatar_color") || "#bae672";
    } catch {
      return "#bae672";
    }
  });

  // Sync state if preferences change
  useEffect(() => {
    setForm({ ...p });
  }, [p]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setForm((curr) => ({ ...curr, [key]: value }));

  const variants = [...catalog, ...customVariants];
  const favorite = variants.find((v) => v.id === form.favoriteId);

  const selectedIconObj =
    AVATAR_ICONS.find((i) => i.id === avatarIcon) || AVATAR_ICONS[0];
  const SelectedIcon = selectedIconObj.Icon;
  const activeColor = avatarColor || "#bae672";

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSaving(true);
    const ok = await perform(
      () => savePreferences({ ...form, onboarded: true }),
      "Profile saved to this device.",
    );
    setSaving(false);
    if (ok) {
      try {
        localStorage.setItem("baga_profile_avatar_icon", avatarIcon);
        localStorage.setItem("baga_profile_avatar_color", avatarColor);
        window.dispatchEvent(new Event("baga-avatar-update"));
      } catch {}
      toast("Profile updated successfully.");
    }
  }

  return (
    <div className="profile-page-clean">
      <PageTitle
        eyebrow="PERSONAL SPACE"
        title="Profile"
        description="Your personal details and habits, kept privately on this device."
        action={
          <button
            className="button primary"
            onClick={() => handleSave()}
            disabled={saving}
          >
            <Check size={16} />
            {saving ? "Saving…" : "Save profile"}
          </button>
        }
      />

      {/* Live Profile Card */}
      <section className="card profile-preview-card">
        <div className="profile-preview-layout">
          <div
            className="profile-preview-avatar"
            style={{
              backgroundColor: activeColor,
              boxShadow: `0 0 24px ${activeColor}35`,
            }}
          >
            <SelectedIcon size={34} color="#111614" />
          </div>

          <div className="profile-preview-info">
            <div className="profile-preview-header">
              <h2>{form.name ? form.name : "Your personal space"}</h2>
              <span className="privacy-pill">
                <ShieldCheck size={13} />
                Saved locally
              </span>
            </div>

            <p className="profile-preview-sub">
              {form.goalMode === "quit"
                ? "Smoke-free journey"
                : form.goalMode === "track"
                  ? "Habit tracking (no limits)"
                  : `Daily limit: ${form.dailyLimit} stick${form.dailyLimit === 1 ? "" : "s"}`}
              {" · "}
              {favorite?.brand || "Brand"} {favorite?.name || ""}
              {form.price > 0 && ` · ₱${perStick(form).toFixed(2)}/stick`}
              {form.customPricePrompt && " · Custom store price"}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSave} className="profile-form-grid">
        {/* Section 1: About You */}
        <section className="card form-card">
          <CardTitle
            title="About You"
            subtitle="Personalize your name and avatar appearance."
          />

          <div className="form-fields-stack">
            <Field label="What should we call you?">
              <input
                type="text"
                autoComplete="given-name"
                placeholder="Enter your name or nickname"
                maxLength={40}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
              />
            </Field>

            <div className="field-block">
              <label className="field-title">Choose Avatar Symbol</label>
              <div className="avatar-symbols-list">
                {AVATAR_ICONS.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    type="button"
                    className={`avatar-pill-btn ${avatarIcon === id ? "active" : ""}`}
                    onClick={() => setAvatarIcon(id)}
                    aria-label={`Select ${label} symbol`}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="field-block">
              <label className="field-title">Avatar Accent Color</label>
              <div className="avatar-colors-list">
                {AVATAR_COLORS.map(({ id, label, hex }) => (
                  <button
                    key={id}
                    type="button"
                    className={`avatar-color-circle ${avatarColor === id ? "active" : ""}`}
                    style={{ backgroundColor: hex }}
                    onClick={() => setAvatarColor(id)}
                    title={label}
                    aria-label={`Color ${label}`}
                  >
                    {avatarColor === id && <Check size={16} color="#111614" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Habit & Goals */}
        <section className="card form-card">
          <CardTitle
            title="Smoking Habit & Goals"
            subtitle="Set your pace, chosen brand, and daily limits."
          />

          <div className="form-fields-stack">
            <div className="field-block">
              <label className="field-title">Your Goal Mode</label>
              <div className="goal-pills-row">
                {(
                  [
                    ["reduce", "Daily limit", "Stay under a ceiling"],
                    ["quit", "Smoke-free", "Work toward zero"],
                    ["track", "Tracking", "No pressure or target"],
                  ] as const
                ).map(([mode, label, sub]) => (
                  <button
                    key={mode}
                    type="button"
                    className={`goal-card-btn ${form.goalMode === mode ? "active" : ""}`}
                    onClick={() => update("goalMode", mode as GoalMode)}
                  >
                    <strong>{label}</strong>
                    <small>{sub}</small>
                  </button>
                ))}
              </div>
            </div>

            {form.goalMode !== "track" && (
              <Field
                label={
                  form.goalMode === "quit"
                    ? "Daily limit before your quit date"
                    : "Daily cigarette limit"
                }
              >
                <div className="comfortable-stepper">
                  <button
                    type="button"
                    className="stepper-touch-btn"
                    onClick={() =>
                      update("dailyLimit", Math.max(0, form.dailyLimit - 1))
                    }
                    aria-label="Decrease daily limit"
                  >
                    <Minus size={18} />
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    className="stepper-number-input"
                    value={form.dailyLimit}
                    onChange={(e) =>
                      update(
                        "dailyLimit",
                        Math.max(0, Number(e.target.value) || 0),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="stepper-touch-btn"
                    onClick={() =>
                      update("dailyLimit", Math.min(100, form.dailyLimit + 1))
                    }
                    aria-label="Increase daily limit"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </Field>
            )}

            <Field label="Usual Brand & Variant">
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

            <div className="two-col-fields">
              <Field label="Price (PHP ₱)">
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => update("price", Number(e.target.value) || 0)}
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

            <label className="toggle-row profile-toggle-row">
              <div>
                <strong>Custom price per stick on log</strong>
                <small>
                  Prompt for store price each time you log because stick prices
                  vary by store.
                </small>
              </div>
              <input
                type="checkbox"
                role="switch"
                checked={form.customPricePrompt}
                onChange={(e) => update("customPricePrompt", e.target.checked)}
              />
            </label>
          </div>
        </section>

        {/* Section 3: First-time Guide / New User Setup */}
        <section className="card form-card new-user-card">
          <CardTitle
            title="First-time Setup Guide"
            subtitle="Walk through the step-by-step introduction to BAGA."
          />
          <div className="new-user-guide-row">
            <p className="new-user-guide-text">
              Looking for the step-by-step onboarding walkthrough? You can open
              the guided setup at any time.
            </p>
            <button
              type="button"
              className="button secondary compact"
              onClick={openOnboarding}
            >
              Open new user setup
              <ArrowRight size={16} />
            </button>
          </div>
        </section>

        {/* Section 4: Reset Local Storage for New Users */}
        <section className="card form-card reset-card">
          <CardTitle
            title="Reset Local Storage (New Users)"
            subtitle="Clear your device storage and experience BAGA as a first-time visitor."
          />
          <div className="new-user-guide-row">
            <p className="new-user-guide-text">
              Want to start completely fresh? This clears all local financial
              transactions, budgets, diary records and profile settings from
              IndexedDB and local storage.
            </p>
            {confirmReset ? (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="button danger compact"
                  onClick={async () => {
                    try {
                      localStorage.clear();
                      sessionStorage.clear();
                      await eraseData();
                    } catch {}
                    window.location.assign("/");
                  }}
                >
                  <RotateCcw size={16} />
                  Confirm: reset everything
                </button>
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => setConfirmReset(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="button danger compact"
                onClick={() => setConfirmReset(true)}
              >
                <RotateCcw size={16} />
                Reset for new users
              </button>
            )}
          </div>
        </section>
      </form>

      {/* Save Button & Privacy Assurance */}
      <div className="profile-bottom-actions">
        <button
          className="button primary save-large-btn"
          onClick={() => handleSave()}
          disabled={saving}
        >
          <Check size={18} />
          {saving ? "Saving…" : "Save profile"}
        </button>

        <p className="device-storage-notice">
          <ShieldCheck size={15} />
          <span>
            All information is saved locally on your device in IndexedDB. BAGA
            never uploads your diary without your permission.
          </span>
        </p>
      </div>
    </div>
  );
}
