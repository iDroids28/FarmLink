import { useCallback, useEffect, useRef, useState } from "react";
import {
  Settings as SettingsIcon,
  ShieldCheck,
  Bell,
  Lock,
  SlidersHorizontal,
  Info,
  Mail,
  Eye,
  Activity,
  Globe,
  Sun,
  Ruler,
  LogOut,
  X,
  Check,
} from "lucide-react";
import ConfirmDialog from "./ConfirmDialog.jsx";
import {
  API_URL,
  safeFetchJson,
  OTP_SEND_OPTIONS,
  getUserMessage,
  getEmailError,
  getPasswordError,
  sanitizeEmail,
  sanitizePassword,
  TextField,
  PasswordField,
  PasswordRules,
  OtpField,
  PrimaryButton,
  ErrorText,
} from "../AuthShared";
import { applyAppearance, saveAppearance } from "../utils/appearance.js";

// Change this to your real support address.
const SUPPORT_EMAIL = "support@farmlink.app";

const SETTINGS_URL = API_URL.replace(/\/auth\/?$/, "") + "/settings";
const JSON_HEADERS = { "Content-Type": "application/json" };

function request(path, method, body) {
  return safeFetchJson(`${SETTINGS_URL}${path}`, {
    method,
    headers: JSON_HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
}


function mergeSettings(s, patch) {
  const next = { ...s };
  for (const [k, v] of Object.entries(patch)) {
    next[k] = v && typeof v === "object" ? { ...s[k], ...v } : v;
  }
  return next;
}

/* ---------------- SMALL UI PIECES ---------------- */

function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={
        "relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " +
        (checked ? "bg-[#2E7D32]" : "bg-gray-300")
      }
    >
      <span
        className={
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " +
          (checked ? "left-[22px]" : "left-0.5")
        }
      />
    </button>
  );
}

const outlineBtn =
  "rounded-lg border border-[#2E7D32] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#2E7D32] transition hover:bg-[#E8F5E9] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]";

const selectClass =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] text-[#16301F] outline-none focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/25";

function SectionCard({ id, icon: Icon, title, subtitle, children }) {
  return (
    <section id={`settings-${id}`} className="scroll-mt-4 rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
          <Icon size={21} />
        </span>
        <div>
          <h3 className="text-[16px] font-bold text-[#16301F]">{title}</h3>
          <p className="text-[12.5px] text-gray-500">{subtitle}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Row({ icon: Icon, title, desc, children }) {
  return (
    <div className="flex items-center gap-3 border-t border-black/5 py-3 first:border-t-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-[#2E7D32]">
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-[#16301F]">{title}</p>
        {desc && <p className="break-words text-[12.5px] text-gray-500">{desc}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-[380px] overflow-hidden rounded-3xl bg-white px-6 py-7 shadow-2xl">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: "linear-gradient(90deg, #8BC34A, #4CAF50, #2E7D32)" }}
        />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X size={18} />
        </button>
        <h2 className="mb-4 text-[18px] font-bold text-[#1B5E20]">{title}</h2>
        {children}
      </div>
    </div>
  );
}

/* ---------------- MODALS ---------------- */

function EmailModal({ onClose, onDone }) {
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function submit(e) {
    e.preventDefault();
    if (busy) return;
    const clean = newEmail.trim().toLowerCase();
    const emailErr = getEmailError(clean);
    if (emailErr) return setError(emailErr);
    if (!password) return setError("Enter your current password to confirm.");
    setError("");
    setBusy(true);
    request("/email", "POST", { newEmail: clean, password })
      .then(() => onDone("Email updated."))
      .catch((err) => {
        setBusy(false);
        setError(getUserMessage(err));
      });
  }

  return (
    <Modal title="Change email address" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        <TextField
          icon={Mail}
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(sanitizeEmail(e.target.value))}
          placeholder="New Gmail address"
        />
        <PasswordField
          value={password}
          onChange={(e) => setPassword(sanitizePassword(e.target.value))}
          placeholder="Current Password"
          autoComplete="current-password"
          show={show}
          onToggle={() => setShow((s) => !s)}
        />
        <ErrorText>{error}</ErrorText>
        <PrimaryButton loading={busy} loadingText="SAVING...">
          SAVE EMAIL
        </PrimaryButton>
      </form>
    </Modal>
  );
}

function PasswordModal({ onClose, onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState({ cur: false, next: false, confirm: false });
  const [challengeId, setChallengeId] = useState("");
  const [emailForOtp, setEmailForOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const toggle = (k) => setShow((s) => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (challengeId) {
      if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit code from your email.");
      setBusy(true);
      try {
        await safeFetchJson(`${API_URL}/change-password/verify-otp`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ challengeId, code: otp }),
        });
        onDone("Password changed. Other devices were logged out.");
      } catch (err) {
        setBusy(false);
        setError(getUserMessage(err));
      }
      return;
    }

    if (!current || !next || !confirm) return setError("Please fill out all fields.");
    const pwErr = getPasswordError(next);
    if (pwErr) return setError(pwErr);
    if (next !== confirm) return setError("Passwords do not match.");
    if (next === current) return setError("Your new password must be different from the current one.");
    setBusy(true);
    try {
      const data = await safeFetchJson(`${API_URL}/change-password`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
        ...OTP_SEND_OPTIONS,
      });
      setChallengeId(data.challengeId);
      setEmailForOtp(data.email || "your registered email");
      setResendIn(Number(data.resendAfterSeconds) || 30);
      setOtp("");
      setBusy(false);
    } catch (err) {
      setBusy(false);
      setError(getUserMessage(err));
    }
  }

  async function resendOtp() {
    if (!challengeId || busy || resendIn > 0) return;
    setBusy(true);
    setError("");
    try {
      const data = await safeFetchJson(`${API_URL}/change-password/resend-otp`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ challengeId }),
        ...OTP_SEND_OPTIONS,
      });
      setEmailForOtp(data.email || emailForOtp);
      setResendIn(Number(data.resendAfterSeconds) || 30);
      setOtp("");
    } catch (err) {
      if (err?.retryAfter) setResendIn(err.retryAfter);
      setError(getUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={challengeId ? "Verify password change" : "Change password"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5" noValidate>
        {challengeId ? (
          <>
            <p className="text-[13px] leading-5 text-gray-600">
              We sent a 6-digit verification code to <b className="text-[#16301F]">{emailForOtp}</b>. Enter it to save your new password. The code expires in 10 minutes.
            </p>
            <OtpField value={otp} onChange={setOtp} />
            <button type="button" onClick={resendOtp} disabled={busy || resendIn > 0} className="w-full text-[12.5px] font-semibold text-[#2E7D32] disabled:text-gray-400">
              {busy ? "Sending..." : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
            </button>
          </>
        ) : (
          <>
            <PasswordField
              value={current}
              onChange={(e) => setCurrent(sanitizePassword(e.target.value))}
              placeholder="Current Password"
              autoComplete="current-password"
              show={show.cur}
              onToggle={() => toggle("cur")}
            />
            <PasswordField
              value={next}
              onChange={(e) => setNext(sanitizePassword(e.target.value))}
              placeholder="New Password"
              autoComplete="new-password"
              show={show.next}
              onToggle={() => toggle("next")}
            />
            <PasswordRules password={next} />
            <PasswordField
              value={confirm}
              onChange={(e) => setConfirm(sanitizePassword(e.target.value))}
              placeholder="Confirm New Password"
              autoComplete="new-password"
              show={show.confirm}
              onToggle={() => toggle("confirm")}
            />
          </>
        )}
        <ErrorText>{error}</ErrorText>
        <PrimaryButton loading={busy} loadingText={challengeId ? "VERIFYING..." : "SENDING CODE..."}>
          {challengeId ? "VERIFY CODE & CHANGE PASSWORD" : "SEND VERIFICATION CODE"}
        </PrimaryButton>
      </form>
    </Modal>
  );
}

/* ---------------- THE PAGE ---------------- */

export default function SettingsPage({ config, user, onRefreshUser, onLogout }) {
  const [settings, setSettings] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [modal, setModal] = useState(null); // "email" | "password"
  const [toast, setToast] = useState(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [activeSection, setActiveSection] = useState("account");
  const toastTimer = useRef(null);

  const sections = [
    { id: "account", icon: ShieldCheck, title: "Account & Security", sub: "Change password and manage account security" },
    { id: "notifications", icon: Bell, title: "Notifications", sub: "Manage your notification preferences" },
    ...(config.privacy
      ? [{ id: "privacy", icon: Lock, title: "Privacy", sub: "Control your privacy settings" }]
      : []),
    { id: "preferences", icon: SlidersHorizontal, title: "Preferences", sub: "Customize your app experience" },
    { id: "help", icon: Info, title: "Help & Support", sub: "Get help and contact support" },
  ];

  const flash = useCallback((text, type = "ok") => {
    setToast({ text, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const load = useCallback(() => {
    setLoadError("");
    request("", "GET")
      .then((d) => setSettings(d.settings))
      .catch((err) => setLoadError(getUserMessage(err)));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Theme / language follow the saved preferences.
  useEffect(() => {
    if (!settings) return;
    saveAppearance(settings.preferences);
    applyAppearance(settings.preferences);
  }, [settings?.preferences]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant switch, then save. If the server refuses, it flips back.
  async function save(patch) {
    const before = settings;
    setSettings((s) => mergeSettings(s, patch));
    try {
      const d = await request("", "PUT", patch);
      setSettings(d.settings);
      flash("Saved");
    } catch (err) {
      setSettings(before);
      flash(getUserMessage(err), "error");
    }
  }

  function goTo(id) {
    setActiveSection(id);
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function modalDone(message) {
    setModal(null);
    flash(message);
    Promise.resolve(onRefreshUser?.()).catch(() => {});
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#E8F5E9] text-[#2E7D32]">
          <SettingsIcon size={26} />
        </span>
        <div>
          <h2 className="text-[26px] font-bold leading-tight text-[#16301F]">Settings</h2>
          <p className="text-[13.5px] text-gray-500">
            Manage your account preferences, security, and notifications.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Left menu */}
        <nav
          aria-label="Settings sections"
          className="self-start rounded-2xl border border-black/5 bg-white p-2.5 shadow-sm lg:sticky lg:top-4"
        >
          {sections.map(({ id, icon: Icon, title, sub }) => {
            const on = id === activeSection;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTo(id)}
                aria-current={on ? "true" : undefined}
                className={
                  "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] " +
                  (on ? "bg-[#E8F5E9]" : "hover:bg-black/[0.03]")
                }
              >
                <span className="mt-0.5 text-[#2E7D32]">
                  <Icon size={20} />
                </span>
                <span>
                  <span className={"block text-[14px] font-semibold " + (on ? "text-[#1B5E20]" : "text-[#16301F]")}>
                    {title}
                  </span>
                  <span className="block text-[12.5px] text-gray-500">{sub}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {/* Right cards */}
        <div className="min-w-0 space-y-5">
          {loadError ? (
            <div className="rounded-2xl border border-red-100 bg-white p-6 text-center shadow-sm">
              <p className="text-[14px] text-[#C62828]">{loadError}</p>
              <button type="button" onClick={load} className={outlineBtn + " mt-3"}>
                Try again
              </button>
            </div>
          ) : !settings ? (
            <div className="rounded-2xl border border-black/5 bg-white p-6 text-[14px] text-gray-500 shadow-sm">
              Loading your settings...
            </div>
          ) : (
            <>
              {/* ACCOUNT & SECURITY */}
              <SectionCard id="account" icon={ShieldCheck} title="Account & Security" subtitle="Keep your account safe and secure.">
                <Row icon={Mail} title="Email Address" desc={user?.email || "—"}>
                  <button type="button" className={outlineBtn} onClick={() => setModal("email")}>
                    Edit
                  </button>
                </Row>
                <Row icon={Lock} title="Password" desc="••••••••">
                  <button type="button" className={outlineBtn} onClick={() => setModal("password")}>
                    Change Password
                  </button>
                </Row>
                <Row
                  icon={ShieldCheck}
                  title="Two-Factor Authentication"
                  desc="When enabled, FarmLink emails a verification code every time you log in."
                >
                  <div className="flex items-center gap-2">
                    <span className={"rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide " + (settings.twoFactorEnabled ? "bg-[#E8F5E9] text-[#2E7D32]" : "bg-gray-100 text-gray-500")}>
                      {settings.twoFactorEnabled ? "Enabled" : "Off"}
                    </span>
                    <Switch
                      checked={!!settings.twoFactorEnabled}
                      onChange={(value) => save({ twoFactorEnabled: value })}
                      label="Two-factor authentication"
                    />
                  </div>
                </Row>
              </SectionCard>

              {/* NOTIFICATIONS */}
              <SectionCard id="notifications" icon={Bell} title="Notifications" subtitle="Choose what you want to be notified about.">
                {config.notifications.map(({ key, icon, label, desc }) => (
                  <Row key={key} icon={icon} title={label} desc={desc}>
                    <Switch
                      checked={!!settings.notifications[key]}
                      onChange={(v) => save({ notifications: { [key]: v } })}
                      label={label}
                    />
                  </Row>
                ))}
              </SectionCard>

              {/* PRIVACY */}
              {config.privacy && (
                <SectionCard id="privacy" icon={Lock} title="Privacy" subtitle="Manage how your information is used and shared.">
                  <Row icon={Eye} title="Profile Visibility" desc="Choose who can see your profile information.">
                    <select
                      value={settings.privacy.profileVisibility}
                      onChange={(e) => save({ privacy: { profileVisibility: e.target.value } })}
                      className={selectClass}
                      aria-label="Profile visibility"
                    >
                      <option value="only_me">Only Me</option>
                      <option value="members">FarmLink Members</option>
                    </select>
                  </Row>
                  <Row icon={Activity} title="Show My Activity" desc={config.activityText}>
                    <Switch
                      checked={settings.privacy.showActivity}
                      onChange={(v) => save({ privacy: { showActivity: v } })}
                      label="Show my activity"
                    />
                  </Row>
                </SectionCard>
              )}

              {/* PREFERENCES */}
              <SectionCard id="preferences" icon={SlidersHorizontal} title="Preferences" subtitle="Customize your experience.">
                <Row icon={Globe} title="Language" desc="Select your preferred language.">
                  <select
                    value={settings.preferences.language}
                    onChange={(e) => save({ preferences: { language: e.target.value } })}
                    className={selectClass}
                    aria-label="Language"
                  >
                    <option value="en">English</option>
                    <option value="fil">Filipino</option>
                  </select>
                </Row>
                <Row icon={Sun} title="Theme" desc="Choose your preferred appearance.">
                  <select
                    value={settings.preferences.theme}
                    onChange={(e) => save({ preferences: { theme: e.target.value } })}
                    className={selectClass}
                    aria-label="Theme"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="system">Same as device</option>
                  </select>
                </Row>
                <Row icon={Ruler} title="Units of Measurement" desc="Select your preferred unit system.">
                  <select
                    value={settings.preferences.units}
                    onChange={(e) => save({ preferences: { units: e.target.value } })}
                    className={selectClass}
                    aria-label="Units of measurement"
                  >
                    <option value="metric">Metric (kg, tons, liters)</option>
                    <option value="imperial">Imperial (lb, oz, gal)</option>
                  </select>
                </Row>
              </SectionCard>

              {/* HELP & SUPPORT */}
              <SectionCard id="help" icon={Info} title="Help & Support" subtitle="Answers to common questions and how to reach us.">
                <div className="divide-y divide-black/5">
                  {config.faq.map(({ q, a }) => (
                    <details key={q} className="group py-3">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[14px] font-semibold text-[#16301F]">
                        {q}
                        <span className="text-[#2E7D32] transition group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-2 text-[13px] leading-relaxed text-gray-600">{a}</p>
                    </details>
                  ))}
                </div>
                <a
                  href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`FarmLink support (${config.roleLabel})`)}`}
                  className={outlineBtn + " mt-3 inline-flex items-center gap-2"}
                >
                  <Mail size={14} /> Contact Support
                </a>
              </SectionCard>

              {/* LOG OUT */}
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex w-full items-center justify-between rounded-xl bg-[#E8F5E9] px-5 py-3 text-[14px] font-semibold text-[#1B5E20] transition hover:bg-[#DCEFDD] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]"
              >
                <span className="flex items-center gap-2.5">
                  <LogOut size={18} /> Log Out
                </span>
                <LogOut size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {modal === "email" && <EmailModal onClose={() => setModal(null)} onDone={modalDone} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} onDone={modalDone} />}

      <ConfirmDialog
        open={confirmLogout}
        title="Are you sure you want to log out?"
        cancelLabel="Cancel"
        confirmLabel="Logout"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => {
          setConfirmLogout(false);
          onLogout?.();
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium text-white shadow-lg"
          style={{ background: toast.type === "error" ? "#C62828" : "#2E7D32" }}
        >
          {toast.type !== "error" && <Check size={15} strokeWidth={3} />}
          {toast.text}
        </div>
      )}
    </div>
  );
}