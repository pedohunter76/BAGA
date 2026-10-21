import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useRegisterSW } from "virtual:pwa-register/react";
import { ZodError } from "zod";
import {
  Bell,
  House,
  List,
  Wind,
  ChartNoAxesCombined,
  Flag,
  CalendarDays,
  Library,
  Settings,
  ArrowUpRight,
  Plus,
  ShieldCheck,
  WifiOff,
  Check,
  X,
  Download,
  Wallet,
  Leaf,
  Menu,
  Cloud,
  User,
} from "lucide-react";
import { AppContext } from "./context";
import { readState, saveLog, setDeleted } from "./db";
import { catalog, defaults, perStick, localDateTime } from "./domain";
import type { CigaretteLog, View } from "./domain";
import { Logo, Modal } from "./ui";
import { OnboardingDialog, LogDialog, QuickPriceDialog } from "./dialogs";
import { NotificationManager } from "./NotificationManager";
import { NotificationInbox } from "./NotificationInbox";
import { db } from "./db";
import { WelcomePage } from "./WelcomePage";
import { AccountPage } from "./AccountPage";
import { BudgetPage } from "./BudgetPage";
import { CloudAutoSync } from "./CloudAutoSync";
const Dashboard = lazy(() =>
  import("./pages").then((module) => ({ default: module.Dashboard })),
);
const History = lazy(() =>
  import("./pages").then((module) => ({ default: module.History })),
);
const Insights = lazy(() =>
  import("./pages").then((module) => ({ default: module.Insights })),
);
const Goals = lazy(() =>
  import("./pages").then((module) => ({ default: module.Goals })),
);
const Calendar = lazy(() =>
  import("./pages").then((module) => ({ default: module.Calendar })),
);
const LibraryPage = lazy(() =>
  import("./pages").then((module) => ({ default: module.LibraryPage })),
);
const SettingsPage = lazy(() =>
  import("./pages").then((module) => ({ default: module.SettingsPage })),
);
const ProfilePage = lazy(() =>
  import("./ProfilePage").then((module) => ({ default: module.ProfilePage })),
);

const nav = [
  { id: "home", label: "Overview", icon: House },
  { id: "log", label: "My diary", icon: List },
  { id: "budget", label: "Budget", icon: Wallet },
  { id: "insights", label: "Insights", icon: ChartNoAxesCombined },
  { id: "goals", label: "Goals & streaks", icon: Flag },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "library", label: "Brand library", icon: Library },
  { id: "account", label: "Account & sync", icon: Cloud },
  { id: "profile", label: "Profile", icon: User },
] as const;
function viewFromURL(): View {
  const value = new URLSearchParams(window.location.search).get("view");
  if (value === "cravings") return "budget";
  return [...nav.map((n) => n.id), "settings"].includes(value || "")
    ? (value as View)
    : "home";
}
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function App() {
  const [view, setView] = useState<View>(viewFromURL);
  const [now, setNow] = useState(new Date());
  const [offline, setOffline] = useState(!navigator.onLine);
  const [dialog, setDialog] = useState<
    "onboard" | "log" | "customPrice" | "install" | null
  >(null);
  const [editLog, setEditLog] = useState<CigaretteLog>();
  const [logDate, setLogDate] = useState<string>();
  const [pendingLog, setPendingLog] = useState(false);
  const [menu, setMenu] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [notification, setNotification] = useState<{
    message: string;
    undo?: () => Promise<unknown>;
    error?: boolean;
  } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [logging, setLogging] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string>(() => {
    try {
      return localStorage.getItem("baga_profile_avatar_color") || "";
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const onAvatarUpdate = () => {
      try {
        setAvatarColor(localStorage.getItem("baga_profile_avatar_color") || "");
      } catch {}
    };
    window.addEventListener("baga-avatar-update", onAvatarUpdate);
    window.addEventListener("storage", onAvatarUpdate);
    return () => {
      window.removeEventListener("baga-avatar-update", onAvatarUpdate);
      window.removeEventListener("storage", onAvatarUpdate);
    };
  }, []);
  const [inboxOpen, setInboxOpen] = useState(false);
  const unread =
    useLiveQuery(
      () => db.notifications.filter((row) => !row.readAt).count(),
      [],
    ) ?? 0;
  const [unsavedWork, setUnsavedWork] = useState(false);
  const heading = useRef<HTMLElement>(null);
  const result = useLiveQuery(async () => {
    try {
      return { state: await readState(), error: "" };
    } catch {
      return {
        state: {
          preferences: defaults,
          preferencesRecoveryNeeded: false,
          logs: [],
          checkins: [],
          measurements: [],
          customVariants: [],
          cravings: [],
          budget: undefined,
          finances: [],
        },
        error:
          "Your browser could not open the local diary. Enable site storage or try another browser. Nothing has been saved.",
      };
    }
  }, []);
  const state = result?.state;
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  const toast = useCallback(
    (message: string) => setNotification({ message }),
    [],
  );
  const perform = useCallback(
    async (
      action: () => Promise<unknown>,
      message?: string,
      undo?: () => Promise<unknown>,
    ) => {
      const control = document.activeElement;
      const submittedForm =
        control instanceof HTMLButtonElement && control.type === "submit"
          ? control.form
          : null;
      try {
        await action();
        if (submittedForm) {
          delete submittedForm.dataset.unsaved;
          setUnsavedWork(!!document.querySelector('form[data-unsaved="true"]'));
        }
        if (message) setNotification({ message, undo });
        return true;
      } catch (error) {
        const detail =
          error instanceof ZodError
            ? error.issues[0]?.message
            : error instanceof Error &&
                !/quota|indexed|database|storage|transaction/i.test(
                  error.message,
                )
              ? error.message
              : "Could not save on this device. Check browser storage and try again. Your entry is still open.";
        setNotification({
          message: detail || "Could not save this entry. Please try again.",
          error: true,
        });
        return false;
      }
    },
    [],
  );
  const navigate = useCallback((target: View) => {
    setView(target);
    setMenu(false);
    setUnsavedWork(false);
    window.history.pushState(
      {},
      "",
      target === "home" ? "/" : `/?view=${target}`,
    );
    window.scrollTo({ top: 0, left: 0 });
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, left: 0 });
    });
  }, []);
  const openLog = (existing?: CigaretteLog, date?: string) => {
    if (!state?.preferences.onboarded) {
      setPendingLog(true);
      setDialog("onboard");
      return;
    }
    setEditLog(existing);
    setLogDate(date);
    setDialog("log");
  };
  async function quickLog() {
    if (logging || !state) return;
    if (!state.preferences.onboarded) {
      setPendingLog(true);
      setDialog("onboard");
      return;
    }
    const p = state.preferences;
    if (p.customPricePrompt) {
      setEditLog(undefined);
      setLogDate(undefined);
      setDialog("customPrice");
      return;
    }
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(20);
      } catch {}
    }
    setLogging(true);
    const variant = [...catalog, ...state.customVariants].find(
      (v) => v.id === p.favoriteId,
    );
    let row: CigaretteLog | undefined;
    await perform(
      async () => {
        if (!variant)
          throw new Error("Choose a favorite brand in settings first.");
        row = await saveLog({
          variantId: variant.id,
          brand: variant.brand,
          variant: variant.name,
          quantity: 1,
          smokedAt: new Date().toISOString(),
          priceSnapshot: perStick(p),
          trigger: "None",
          mood: "",
          location: "",
          notes: "",
        });
      },
      "One cigarette saved to your diary.",
      async () => {
        if (row) await setDeleted(row.id, true);
      },
    );
    setLogging(false);
  }
  async function install() {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") toast("BAGA is being installed.");
      setInstallPrompt(null);
    } else setDialog("install");
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    const online = () => setOffline(!navigator.onLine);
    const pop = () => {
      setView(viewFromURL());
      window.scrollTo({ top: 0, left: 0 });
    };
    const ready = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallEvent);
    };
    const installed = () => {
      setInstallPrompt(null);
      toast("BAGA is installed.");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    window.addEventListener("popstate", pop);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", installed);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", installed);
    };
  }, [toast]);
  useEffect(() => {
    if (!notification || notification.error) return;
    const timer = setTimeout(
      () => setNotification(null),
      notification.undo ? 10_000 : 6000,
    );
    return () => clearTimeout(timer);
  }, [notification]);
  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.theme = state.preferences.theme;
    document.documentElement.dataset.motion = state.preferences.animation
      ? "on"
      : "off";
  }, [state, now, toast]);

  const p = state?.preferences || defaults;
  const pages = {
    home: Dashboard,
    log: History,
    insights: Insights,
    goals: Goals,
    calendar: Calendar,
    library: LibraryPage,
    settings: SettingsPage,
    budget: BudgetPage,
    account: AccountPage,
    profile: ProfilePage,
  };
  const Page = pages[view];
  const welcome =
    !!state &&
    !result?.error &&
    !p.onboarded &&
    !welcomeDismissed &&
    view === "home";
  const profilePage = dialog === "onboard";
  const opening = welcome || profilePage;
  return (
    <div
      className={`app-shell ${opening ? "opening-shell" : ""}`}
      onChange={(event) => {
        const form = (event.target as HTMLElement).closest("form");
        if (form) {
          form.dataset.unsaved = "true";
          setUnsavedWork(true);
        }
      }}
    >
      <aside
        className="sidebar"
        aria-label="Main navigation"
        id="primary-navigation"
      >
        <div className="sidebar-brand">
          <Logo />
          <span>YOUR DAILY BREATH</span>
        </div>
        <div className="nav-label">YOUR SPACE</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              aria-current={view === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {view === id && <i />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="leaf-badge">
              <Leaf size={20} />
            </span>
            <h3>
              Small steps.
              <br />
              Real progress.
            </h3>
            <p>
              Every bit of awareness
              <br />
              is a step forward.
            </p>
            <button onClick={() => navigate("goals")}>
              Find your pace
              <ArrowUpRight size={16} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
          >
            <Settings size={19} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            className="sidebar-profile-btn"
            onClick={() => navigate("profile")}
            aria-label="Open profile"
          >
            <div
              className="avatar"
              style={
                avatarColor
                  ? { backgroundColor: avatarColor, color: "#111614" }
                  : undefined
              }
            >
              {p.name ? p.name[0].toUpperCase() : "Y"}
            </div>
            <div>
              <strong>{p.name || "Your personal space"}</strong>
              <span>
                Local Profile
                <ShieldCheck size={11} />
              </span>
            </div>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={menu}
              onClick={(event) => {
                event.currentTarget.focus();
                setMenu(!menu);
              }}
            >
              <Menu size={20} />
            </button>
            <span className="desktop-breadcrumb">
              My space<span>/</span>
            </span>
            <strong>
              {view === "home"
                ? "Overview"
                : [...nav, { id: "settings", label: "Settings" }].find(
                    (n) => n.id === view,
                  )?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <span className={`local-badge ${offline ? "offline" : ""}`}>
              {offline ? (
                <WifiOff size={13} />
              ) : (
                <span className="status-dot" />
              )}
              {offline ? "Offline · saved locally" : "Stored on your device"}
            </span>
            <span className="date-display">
              <CalendarDays size={15} />
              {new Intl.DateTimeFormat("en-PH", {
                timeZone: p.timezone,
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(now)}
            </span>
            <button
              className="icon-button notification-bell"
              aria-label={`Open notifications${unread ? `, ${unread} unread` : ""}`}
              onClick={() => setInboxOpen(true)}
            >
              <Bell size={20} />
              {unread > 0 && <span>{unread > 9 ? "9+" : unread}</span>}
            </button>
            <button
              className="topbar-avatar"
              aria-label="Open profile"
              style={
                avatarColor
                  ? { backgroundColor: avatarColor, color: "#111614" }
                  : undefined
              }
              onClick={() => navigate("profile")}
            >
              {p.name ? p.name[0].toUpperCase() : "Y"}
            </button>
          </div>
        </header>
        <main ref={heading} tabIndex={-1} className="main-content">
          {!result ? (
            <div className="loading-state" role="status">
              <Logo />
              <p>Opening your private space…</p>
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : result.error ? (
            <div className="storage-error" role="alert">
              <ShieldCheck size={40} />
              <h1>Your diary needs local storage.</h1>
              <p>{result.error}</p>
              <button
                className="button primary"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : (
            state && (
              <AppContext.Provider
                value={{
                  ...state,
                  navigate,
                  openLog,
                  quickLog: () => {
                    void quickLog();
                  },
                  openOnboarding: () => {
                    setPendingLog(false);
                    setDialog("onboard");
                  },
                  perform,
                  toast,
                  now,
                  install: () => {
                    void install();
                  },
                }}
              >
                {state.preferencesRecoveryNeeded && (
                  <p role="alert">
                    Your saved settings could not be loaded. Set up your
                    preferences again; your diary records are still available.
                  </p>
                )}
                <CloudAutoSync />
                <NotificationManager />
                {inboxOpen && (
                  <NotificationInbox close={() => setInboxOpen(false)} />
                )}
                {!profilePage &&
                  (welcome ? (
                    <WelcomePage explore={() => setWelcomeDismissed(true)} />
                  ) : (
                    <Suspense
                      fallback={<p role="status">Opening your page…</p>}
                    >
                      <Page />
                    </Suspense>
                  ))}
                {dialog === "onboard" && (
                  <OnboardingDialog
                    fullPage
                    close={() => setDialog(null)}
                    done={() => {
                      if (pendingLog) {
                        setEditLog(undefined);
                        setLogDate(undefined);
                        setDialog("log");
                      } else {
                        setDialog(null);
                        navigate("home");
                      }
                    }}
                  />
                )}{" "}
                {dialog === "log" && (
                  <LogDialog
                    existing={editLog}
                    date={logDate}
                    close={() => setDialog(null)}
                  />
                )}
                {dialog === "customPrice" && (
                  <QuickPriceDialog close={() => setDialog(null)} />
                )}
              </AppContext.Provider>
            )
          )}
          <footer className="page-footer">
            <span>
              <ShieldCheck size={13} />
              Your habits are personal. Your diary stays that way.
            </span>
            <span>BAGA · Made for a little more awareness.</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.slice(0, 4).map(({ id, label, icon: Icon }) => (
          <button
            className={view === id ? "active" : ""}
            key={id}
            onClick={() => navigate(id)}
            aria-current={view === id ? "page" : undefined}
          >
            <Icon size={21} />
            <span>
              {id === "home" ? "Home" : id === "log" ? "Diary" : label}
            </span>
          </button>
        ))}
        <button
          aria-label="More navigation"
          aria-expanded={menu}
          onClick={(event) => {
            event.currentTarget.focus();
            setMenu(true);
          }}
        >
          <Menu size={21} />
          <span>More</span>
        </button>
      </nav>
      {menu && (
        <Modal
          open
          title="Your space"
          description="Choose where you’d like to go."
          onClose={() => setMenu(false)}
        >
          <nav className="mobile-navigation-menu" aria-label="All pages">
            {[
              ...nav,
              { id: "settings" as const, label: "Settings", icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`nav-item ${view === id ? "active" : ""}`}
                aria-current={view === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </Modal>
      )}
      <div
        aria-live={notification?.error ? "assertive" : "polite"}
        aria-atomic="true"
      >
        {notification && (
          <div
            className={`toast ${notification.error ? "error" : ""} ${notification.undo ? "has-undo" : ""}`}
            role={notification.error ? "alert" : "status"}
          >
            <span className="toast-icon">
              {notification.error ? <X size={18} /> : <Check size={18} />}
            </span>
            <span>{notification.message}</span>
            {notification.undo && (
              <button
                onClick={async () => {
                  if (notification.undo) {
                    const ok = await perform(
                      notification.undo,
                      "Action undone.",
                    );
                    if (!ok) return;
                  }
                }}
              >
                Undo
              </button>
            )}
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setNotification(null)}
            >
              <X size={16} />
            </button>
            {notification.undo && <div className="toast-countdown-bar" />}
          </div>
        )}
      </div>
      {needRefresh && (
        <div className="update-prompt">
          <span>
            {dialog === "log" || dialog === "onboard" || unsavedWork
              ? "A new version is ready. Finish your changes before updating."
              : "A new version is ready. Your saved diary will stay on this device."}
          </span>
          <button
            disabled={dialog === "log" || dialog === "onboard" || unsavedWork}
            onClick={() => {
              void updateServiceWorker(true);
            }}
          >
            Update now
          </button>
          <button
            aria-label="Dismiss update"
            onClick={() => setNeedRefresh(false)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {dialog === "install" && (
        <Modal
          open
          title="A little closer, every day."
          description="Add BAGA to your home screen for quick access."
          onClose={() => setDialog(null)}
        >
          <div className="install-content">
            <span className="empty-icon">
              <Download size={28} />
            </span>
            <h3>Install BAGA</h3>
            <p>
              On iPhone or iPad, open this app in Safari, tap Share, then{" "}
              <strong>Add to Home Screen</strong>.
            </p>
            <p>
              On Android or desktop, look for <strong>Install app</strong> in
              your browser’s menu or address bar. Availability depends on your
              browser.
            </p>
            <div className="notice">
              <ShieldCheck size={18} />
              <span>
                The app caches its shell after a successful online visit. Your
                diary remains on this device.
              </span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
