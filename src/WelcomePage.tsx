import { useLiveQuery } from "dexie-react-hooks";
import { discardDraft, loadDraft } from "./onboarding";
import { ArrowRight, Leaf, ShieldCheck, Smartphone, Wind } from "lucide-react";
import { useApp } from "./context";
import { Logo } from "./ui";

export function WelcomePage({ explore }: { explore: () => void }) {
  const { openOnboarding, navigate, perform } = useApp();
  const draft = useLiveQuery(loadDraft, []);
  return (
    <section className="welcome-page">
      <header className="welcome-header">
        <Logo />
        <span>
          <ShieldCheck size={16} /> Private by default
        </span>
      </header>
      <div className="welcome-layout">
        <div className="welcome-copy">
          <p className="eyebrow">A LITTLE MORE AWARENESS</p>
          <h1>
            A fresh start.
            <br />
            At your pace.
          </h1>
          <p className="welcome-description">
            Meet your habits with a little kindness. Build your profile, keep a
            simple diary, and take each day as it comes.
          </p>
          <button
            className="button primary welcome-primary"
            onClick={openOnboarding}
          >
            {draft ? "Resume my profile" : "Create my profile"}{" "}
            <ArrowRight size={20} />
          </button>
          {draft && (
            <p className="draft-notice">
              Step {Math.min(2, draft.step + 1)} of 2 saved on this device.{" "}
              <button
                onClick={() => {
                  void perform(discardDraft, "Setup draft discarded.");
                }}
              >
                Discard saved setup
              </button>
            </p>
          )}
          <p className="welcome-caption">
            About a minute · No account required
          </p>
          <button
            className="button secondary welcome-explore"
            onClick={explore}
          >
            Explore BAGA first
          </button>
          <div className="welcome-links">
            <button onClick={() => navigate("account")}>
              Already have an account? Sign in
            </button>
            <button onClick={() => navigate("settings")}>
              Restore a diary backup
            </button>
          </div>
        </div>
        <div className="welcome-art" aria-hidden="true">
          <div className="welcome-orbit">
            <Wind size={72} strokeWidth={1.2} />
          </div>
          <span className="welcome-art-label">ONE DAY AT A TIME</span>
          <div className="welcome-art-note">
            <Leaf size={19} />
            <span>Small steps count.</span>
          </div>
        </div>
      </div>
      <footer className="welcome-benefits">
        <span>
          <Leaf size={20} /> Goals that fit your pace
        </span>
        <span>
          <ShieldCheck size={20} /> Your diary stays on your device
        </span>
        <span>
          <Smartphone size={20} /> Ready to use offline
        </span>
      </footer>
    </section>
  );
}
