import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Eye, EyeOff, Lock, Pencil, Save, User, X } from "lucide-react";
import GlassCard from "./GlassCard.jsx";
import { API_URL, safeFetchJson, getPasswordError, OtpField, OTP_SEND_OPTIONS } from "../AuthShared";

// API_URL points at the auth routes (".../api/auth"); strip that to reach /api/profile.
// If your API_URL is different, change this line.
const API_BASE = String(API_URL).replace(/\/auth\/?$/, "");

export const GREEN = "#0F5A43";
const SOFT = "#E3F2E9";

/* ---------------- data hook ---------------- */

export function useProfile() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    return safeFetchJson(`${API_BASE}/profile/me`)
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e?.message || "Could not load your profile."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Sends only the fields you pass; the server keeps the rest.
  async function save(patch) {
    const d = await safeFetchJson(`${API_BASE}/profile/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setData(d);
    return d;
  }

  return { data, loading, error, reload: load, save };
}

export function ProfileShell({ title, subtitle, icon: Icon, state, children }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-[26px] font-bold text-[#0F3D2E]">
          {Icon && <Icon size={26} className="text-[#2E9E5B]" />}
          {title}
        </h2>
        <p className="text-[14px] text-gray-500">{subtitle}</p>
      </div>
      {state.loading && !state.data ? (
        <GlassCard className="p-6 text-[14px] text-gray-500">Loading your profile…</GlassCard>
      ) : state.error && !state.data ? (
        <GlassCard className="p-6 text-[14px] text-red-600">
          {state.error}{" "}
          <button type="button" onClick={state.reload} className="font-semibold underline">
            Try again
          </button>
        </GlassCard>
      ) : (
        children
      )}
    </div>
  );
}

/* ---------------- card layout ---------------- */

export function MediaCircle({ icon: Icon }) {
  return (
    <div
      className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full"
      style={{ background: SOFT }}
    >
      <Icon size={44} style={{ color: GREEN }} />
    </div>
  );
}

export function ProfileCard({ icon: Icon, title, action, media, children }) {
  return (
    <GlassCard className="p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        {media && <div className="flex shrink-0 justify-center sm:w-40">{media}</div>}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="flex items-center gap-2 text-[16.5px] font-semibold" style={{ color: GREEN }}>
              {Icon && <Icon size={19} />}
              {title}
            </h3>
            {action}
          </div>
          {children}
        </div>
      </div>
    </GlassCard>
  );
}

export function OutlineButton({ icon: Icon, children, onClick, disabled, tone = "green", type = "button", className = "" }) {
  const solid = tone === "solid";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-[13px] font-semibold transition " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] disabled:opacity-60 " +
        (solid
          ? "border-transparent bg-[#0F5A43] text-white hover:brightness-110 "
          : "border-[#0F5A43]/60 bg-white text-[#0F5A43] hover:bg-[#0F5A43]/5 ") +
        className
      }
    >
      {Icon && <Icon size={15} />}
      {children}
    </button>
  );
}

export function StatusPill({ children, tone = "green" }) {
  const cls =
    tone === "green"
      ? "bg-[#3DBE74] text-white"
      : tone === "amber"
      ? "bg-amber-100 text-amber-800"
      : "bg-gray-200 text-gray-700";
  return <span className={"inline-block rounded-full px-2.5 py-0.5 text-[12px] font-semibold " + cls}>{children}</span>;
}

/* ---------------- read-only row ---------------- */

export function InfoRow({ label, children }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 py-1.5 text-[14px] sm:grid-cols-[170px_1fr]">
      <span className="text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-[#16301F]">{children || "—"}</span>
    </div>
  );
}

/* ---------------- editable section ----------------
   fields: [{ key, label, readOnly?, type?, placeholder? }]
   values: flat object { key: value }
   onSave(draft) -> Promise (throw to show an error) */

export function EditableSection({ icon, title, media, fields, values, onSave, editLabel = "Edit", footer }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(values);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function start() {
    setDraft(values);
    setError("");
    setEditing(true);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const changed = {};
      fields.forEach((f) => {
        if (!f.readOnly) changed[f.key] = draft[f.key] ?? "";
      });
      await onSave(changed);
      setEditing(false);
    } catch (err) {
      setError(err?.message || "Could not save your changes.");
    } finally {
      setBusy(false);
    }
  }

  const action = editing ? (
    <div className="flex gap-2">
      <OutlineButton icon={X} onClick={() => setEditing(false)} disabled={busy}>
        Cancel
      </OutlineButton>
      <OutlineButton icon={Save} tone="solid" type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </OutlineButton>
    </div>
  ) : (
    <OutlineButton icon={Pencil} onClick={start}>
      {editLabel}
    </OutlineButton>
  );

  return (
    <form onSubmit={submit}>
      <ProfileCard icon={icon} title={title} media={media} action={action}>
        {fields.map((f) =>
          editing && !f.readOnly ? (
            <div key={f.key} className="grid grid-cols-[130px_1fr] items-center gap-3 py-1 sm:grid-cols-[170px_1fr]">
              <label htmlFor={`f-${title}-${f.key}`} className="text-[14px] text-gray-500">
                {f.label}
              </label>
              <input
                id={`f-${title}-${f.key}`}
                type={f.type || "text"}
                value={draft[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-[14px] text-[#16301F] focus:border-[#4CAF50] focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/30"
              />
            </div>
          ) : (
            <InfoRow key={f.key} label={f.label}>
              {values[f.key]}
            </InfoRow>
          )
        )}
        {error && <p className="mt-2 text-[13px] text-red-600">{error}</p>}
        {footer}
      </ProfileCard>
    </form>
  );
}

/* ---------------- photo ---------------- */

// Shrinks the chosen image to a 256px JPEG so it fits the API body limit.
function resizeToDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error("Choose a JPG, PNG or WebP image."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That image could not be read."));
    };
    img.src = url;
  });
}

export function PhotoBlock({ photo, onChange }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await onChange(await resizeToDataUrl(file));
    } catch (err) {
      setError(err?.message || "Could not update your photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full"
        style={{ background: SOFT }}
      >
        {photo ? (
          <img src={photo} alt="Your profile" className="h-full w-full object-cover" />
        ) : (
          <User size={56} style={{ color: GREEN }} />
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
      <OutlineButton icon={Camera} onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Saving…" : "Change Photo"}
      </OutlineButton>
      {error && <p className="max-w-[10rem] text-center text-[12px] text-red-600">{error}</p>}
    </div>
  );
}

/* ---------------- toggle ---------------- */

export function Toggle({ checked, onChange, label, description }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[#16301F]">{label}</p>
        {description && <p className="text-[12.5px] text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={
          "relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2 " +
          (checked ? "bg-[#0F5A43]" : "bg-gray-300")
        }
      >
        <span
          className={
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all " + (checked ? "left-[22px]" : "left-0.5")
          }
        />
      </button>
    </div>
  );
}

/* ---------------- change password ---------------- */

function PasswordInput({ id, label, value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[13.5px] font-medium text-[#16301F]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-[14px] focus:border-[#4CAF50] focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/30"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

export function PasswordForm({ onDone }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [emailForOtp, setEmailForOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" });

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setMsg({ type: "", text: "" });

    if (challengeId) {
      if (!/^\d{6}$/.test(otp)) {
        setMsg({ type: "error", text: "Enter the 6-digit code from your email." });
        return;
      }
      setBusy(true);
      try {
        await safeFetchJson(`${API_URL}/change-password/verify-otp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId, code: otp }),
        });
        setCurrent(""); setNext(""); setConfirm(""); setOtp(""); setChallengeId("");
        setMsg({ type: "ok", text: "Password updated successfully." });
        onDone?.();
      } catch (err) {
        setMsg({ type: "error", text: err?.message || "Could not verify the email code." });
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!current || !next || !confirm) {
      setMsg({ type: "error", text: "Please fill out all fields." });
      return;
    }
    const passwordError = getPasswordError(next);
    if (passwordError) {
      setMsg({ type: "error", text: passwordError });
      return;
    }
    if (next !== confirm) {
      setMsg({ type: "error", text: "The new passwords do not match." });
      return;
    }
    if (next === current) {
      setMsg({ type: "error", text: "Your new password must be different from the current one." });
      return;
    }

    setBusy(true);
    try {
      const data = await safeFetchJson(`${API_URL}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
        ...OTP_SEND_OPTIONS,
      });
      setChallengeId(data.challengeId);
      setEmailForOtp(data.email || "your registered email");
      setResendIn(Number(data.resendAfterSeconds) || 30);
      setOtp("");
      setMsg({ type: "ok", text: `Verification code sent to ${data.email || "your registered email"}.` });
    } catch (err) {
      setMsg({ type: "error", text: err?.message || "Could not send the verification code." });
    } finally {
      setBusy(false);
    }
  }

  async function resendOtp() {
    if (!challengeId || busy || resendIn > 0) return;
    setBusy(true);
    setMsg({ type: "", text: "" });
    try {
      const data = await safeFetchJson(`${API_URL}/change-password/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId }),
        ...OTP_SEND_OPTIONS,
      });
      setEmailForOtp(data.email || emailForOtp);
      setResendIn(Number(data.resendAfterSeconds) || 30);
      setOtp("");
      setMsg({ type: "ok", text: "A new verification code was sent." });
    } catch (err) {
      if (err?.retryAfter) setResendIn(err.retryAfter);
      setMsg({ type: "error", text: err?.message || "Could not resend the verification code." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {challengeId ? (
        <>
          <p className="text-[13px] leading-5 text-gray-600">
            Enter the 6-digit code sent to <b className="text-[#16301F]">{emailForOtp}</b> to confirm this password change. The code expires in 10 minutes.
          </p>
          <OtpField value={otp} onChange={setOtp} />
          <button type="button" onClick={resendOtp} disabled={busy || resendIn > 0} className="w-full text-[12.5px] font-semibold text-[#2E7D32] disabled:text-gray-400">
            {busy ? "Sending..." : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </>
      ) : (
        <>
          <PasswordInput id="pw-current" label="Current Password" value={current} onChange={setCurrent} placeholder="Enter current password" autoComplete="current-password" />
          <PasswordInput id="pw-new" label="New Password" value={next} onChange={setNext} placeholder="Enter new password" autoComplete="new-password" />
          <PasswordInput id="pw-confirm" label="Confirm New Password" value={confirm} onChange={setConfirm} placeholder="Confirm new password" autoComplete="new-password" />
        </>
      )}
      {msg.text && (
        <p className={"text-[13px] " + (msg.type === "ok" ? "text-[#2E7D32]" : "text-red-600")}>{msg.text}</p>
      )}
      <button
        type="submit"
        disabled={busy || (challengeId ? !otp : (!current || !next || !confirm))}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F5A43] py-2.5 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] focus-visible:ring-offset-2"
      >
        <Lock size={15} />
        {busy ? (challengeId ? "Verifying…" : "Sending code…") : (challengeId ? "Verify Code & Update Password" : "Send Verification Code")}
      </button>
    </form>
  );
}

export function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}