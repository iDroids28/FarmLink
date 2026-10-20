import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, ArrowLeft, Check, Circle } from "lucide-react";
import TermsModal from "./TermsModal.jsx";

/* =====================================================================
   Shared pieces for Login.js, Signup.js and Forgot.js
   ===================================================================== */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
export const API_URL = `${API_BASE}/api/auth`;

/* ---------------- STYLES ---------------- */

// Puting background, pero may green mesh glow para hindi plain.
const PAGE_BG = {
  background:
    "radial-gradient(900px 600px at 12% -10%, rgba(76,175,80,0.22) 0%, rgba(76,175,80,0) 60%)," +
    "radial-gradient(800px 600px at 105% 110%, rgba(46,125,50,0.20) 0%, rgba(46,125,50,0) 60%)," +
    "radial-gradient(600px 500px at 85% -5%, rgba(139,195,74,0.18) 0%, rgba(139,195,74,0) 65%)," +
    "#FFFFFF",
};

// Manipis na grid lines sa likod — texture lang, puti pa rin ang dating.
const GRID_OVERLAY = {
  backgroundImage:
    "linear-gradient(rgba(46,125,50,0.06) 1px, transparent 1px)," +
    "linear-gradient(90deg, rgba(46,125,50,0.06) 1px, transparent 1px)",
  backgroundSize: "44px 44px",
  maskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 72%)",
  WebkitMaskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 72%)",
};

const BOX_STYLE = {
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(46,125,50,0.16)",
  boxShadow:
    "0 24px 60px rgba(18,51,26,0.16), 0 2px 8px rgba(18,51,26,0.06), inset 0 1px 0 #fff",
  backdropFilter: "blur(14px)",
};

// Glow sa likod ng logo para tumingkad ang green sa puting background.
const LOGO_GLOW = {
  background:
    "radial-gradient(circle, rgba(76,175,80,0.28) 0%, rgba(76,175,80,0.10) 45%, rgba(76,175,80,0) 70%)",
};

const BUTTON_STYLE = {
  background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
  boxShadow: "0 10px 22px rgba(46,125,50,0.35)",
};

export const INPUT_CLASS =
  "w-full rounded-full bg-[#F4F7F3] border border-[#DCE7DC] pl-11 pr-4 py-3 text-[14px] text-gray-800 placeholder:text-gray-400 outline-none transition focus:bg-white focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/25 disabled:opacity-60 disabled:cursor-not-allowed";

const OTP_INPUT_CLASS =
  "w-full rounded-full bg-[#F4F7F3] border border-[#DCE7DC] px-5 py-3 text-center text-[16px] tracking-[6px] text-gray-800 placeholder:tracking-normal placeholder:text-gray-400 outline-none transition focus:bg-white focus:border-[#4CAF50] focus:ring-2 focus:ring-[#4CAF50]/25";

/* ---------------- LAYOUT COMPONENTS ---------------- */

export function Shell({ children }) {
  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center px-6 py-6 overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif", ...PAGE_BG }}
    >
      {/* grid texture */}
      <div className="pointer-events-none absolute inset-0" style={GRID_OVERLAY} />

      {/* soft green blobs */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full blur-3xl"
        style={{ background: "rgba(76,175,80,0.20)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full blur-3xl"
        style={{ background: "rgba(46,125,50,0.18)" }}
      />

      <div className="relative w-full max-w-[340px]">
        {/* green halo sa likod ng card */}
        <div
          className="pointer-events-none absolute -inset-3 rounded-[2rem] blur-2xl"
          style={{ background: "rgba(76,175,80,0.16)" }}
        />
        <div
          className="relative flex flex-col items-center rounded-3xl px-7 py-9 overflow-hidden"
          style={BOX_STYLE}
        >
          {/* accent bar sa taas ng card */}
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: "linear-gradient(90deg, #8BC34A, #4CAF50, #2E7D32)" }}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

// Logo + brand name, with an optional subtitle under it.
export function Header({ title }) {
  return (
    <>
      <div className="relative mb-2 flex items-center justify-center">
        <div
          className="pointer-events-none absolute h-32 w-32 rounded-full blur-xl"
          style={LOGO_GLOW}
        />
        <img
          src="/logo.png"
          alt="FarmLink logo"
          className="relative w-24 h-24 object-contain drop-shadow-[0_6px_14px_rgba(46,125,50,0.28)]"
        />
      </div>
      <h1 className="text-2xl font-extrabold mb-1 tracking-tight text-[#1B5E20]">
        Farm<span className="text-[#4CAF50]">Link</span>
      </h1>
      <div
        className="mb-3 h-[3px] w-12 rounded-full"
        style={{ background: "linear-gradient(90deg, #8BC34A, #2E7D32)" }}
      />
      {title && <p className="mb-5 text-center text-[13px] text-gray-500">{title}</p>}
    </>
  );
}

/* ---------------- FORM COMPONENTS ---------------- */

export function TextField({ icon: Icon = Mail, ...props }) {
  return (
    <div className="relative">
      <Icon
        size={17}
        className="absolute left-4 top-1/2 -translate-y-1/2"
        color="#6b7280"
      />
      <input {...props} className={INPUT_CLASS} />
    </div>
  );
}

// Password input with the lock icon and the show/hide eye button.
// replace the whole PasswordField function with
export function PasswordField({ value, onChange, placeholder, show, onToggle, autoComplete, name, disabled }) {
  return (
    <div className="relative">
      <Lock
        size={17}
        className="absolute left-4 top-1/2 -translate-y-1/2"
        color="#6b7280"
      />
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        name={name}
        disabled={disabled}
        className={INPUT_CLASS + " pr-11"}
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 disabled:opacity-60"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

// 6-digit numeric OTP box (digits only).
export function OtpField({ value, onChange }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={6}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      placeholder="Enter OTP"
      className={OTP_INPUT_CLASS}
    />
  );
}

// replace the whole PrimaryButton function with
export function PrimaryButton({ loading, loadingText, disabled, children }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="w-full rounded-full py-3 mt-2 text-[14px] font-bold tracking-wide text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
      style={BUTTON_STYLE}
    >
      {loading ? loadingText : children}
    </button>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return (
    <p className="text-[13px] text-center" style={{ color: "#C62828" }}>
      {children}
    </p>
  );
}

export function BackLink({ onClick, label = "Back to Log In" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-5 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#2E7D32] hover:text-[#1B5E20]"
    >
      <ArrowLeft size={14} />
      {label}
    </button>
  );
}

// Live checklist: each rule turns green as the password meets it.
export function PasswordRules({ password }) {
  const results = PASSWORD_RULES.map((rule) => ({
    ...rule,
    met: rule.test(password || ""),
  }));
  const allMet = results.every((r) => r.met);

  return (
    <div className="px-2">
      <p
        className="mb-1.5 text-[12px] font-semibold"
        style={{ color: allMet ? "#2E7D32" : "#6b7280" }}
      >
        {allMet ? "Strong password" : "Password must have:"}
      </p>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-1">
        {results.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-1.5 text-[11.5px]"
            style={{ color: r.met ? "#2E7D32" : "#9ca3af" }}
          >
            {r.met ? <Check size={12} strokeWidth={3} /> : <Circle size={12} />}
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- VALIDATION HELPERS ---------------- */

// Accept common email addresses across providers while rejecting malformed domain
// labels, whitespace, multiple @ signs, and unsafe header characters.
// Keep this aligned with EMAIL_ADDRESS_RE in emailService.js.
const EMAIL_REGEX =
  /^(?=[^@]{1,64}@)[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const v = value.trim();
  return v.length <= 254 && EMAIL_REGEX.test(v);
}

// Returns a specific, human-readable reason the email is invalid, or null if it's fine.
export function getEmailError(value) {
  const v = (typeof value === "string" ? value : "").trim();
  if (!v) return "Please enter your email address.";
  if (/\s/.test(v)) return "Email address cannot contain spaces.";
  if (!v.includes("@")) return "Email address must include '@' (e.g. name@phinmaed.com).";
  if ((v.match(/@/g) || []).length !== 1) return "Please enter a valid email address.";
  if (!isValidEmail(v)) {
    return "Please enter a valid email address (e.g. name@phinmaed.com).";
  }
  return null;
}

// Letters, spaces, hyphens, and apostrophes only — no numbers or symbols in names.
export function sanitizeName(value) {
  return (value || "").replace(/[^a-zA-Z\s'-]/g, "");
}

// Permit common characters used in email addresses and in different domains.
// Spaces are removed while typing; the validator checks the overall structure.
export function sanitizeEmail(value) {
  return (value || "").replace(/\s/g, "");
}

// Strong password rules (used for Sign Up and Reset Password).
export const PASSWORD_RULES = [
  {
    id: "length",
    label: "8+ characters",
    test: (p) => p.length >= 8,
    message: "Password must be at least 8 characters.",
  },
  {
    id: "upper",
    label: "1 uppercase",
    test: (p) => /[A-Z]/.test(p),
    message: "Password must include at least 1 uppercase letter.",
  },
  {
    id: "lower",
    label: "1 lowercase",
    test: (p) => /[a-z]/.test(p),
    message: "Password must include at least 1 lowercase letter.",
  },
  {
    id: "number",
    label: "1 number",
    test: (p) => /[0-9]/.test(p),
    message: "Password must include at least 1 number.",
  },
  {
    id: "special",
    label: "1 special character",
    test: (p) => /[^A-Za-z0-9\s]/.test(p),
    message: "Password must include at least 1 special character (e.g. @ # $ % ^ & * ! ?).",
  },
];

// Returns the first unmet password rule as a message, or null if the password is strong.
export function getPasswordError(value) {
  const p = value || "";
  if (p.length > 64) return "Password must be at most 64 characters.";
  const failed = PASSWORD_RULES.find((rule) => !rule.test(p));
  return failed ? failed.message : null;
}

// Special characters are now allowed in passwords — only spaces are removed.
export function sanitizePassword(value) {
  return (value || "").replace(/\s/g, "");
}

/* ---------------- NETWORK + ERROR HELPERS ---------------- */

// Only messages wrapped in this class are ever shown to users. Anything else
// (a JavaScript error, a parsing error, a library error) is replaced with a
// generic message by getUserMessage() below.
// replace the whole UserFacingError class with
export class UserFacingError extends Error {
  constructor(message, status, retryAfter = 0, code = "") {
    super(message);
    this.name = "UserFacingError";
    this.status = status;
    this.retryAfter = retryAfter; // seconds, used for lockouts / rate limits
    this.code = code; // safe machine-readable server code
  }
}

export const SAFE_MESSAGES = {
  offline: "Unable to connect to the server. Please try again later.",
  unavailable: "The service is temporarily unavailable. Please try again later.",
  generic: "Something went wrong. Please try again.",
  unprocessed: "We couldn't process your request. Please try again.",
  tooMany: "Too many attempts. Please wait a few minutes and try again.",
  otpEmailFailed: "We couldn't send the verification email right now. Please try again in a moment.",
  otpTimeout: "Sending the email took too long. Check your inbox and spam folder before trying again.",
};

// OTP-sending requests get extra time because the backend waits for SMTP.
// Other requests keep their existing 10-second timeout.
export const DEFAULT_TIMEOUT_MS = 10000;
export const OTP_SEND_OPTIONS = {
  timeoutMs: 45000,
  timeoutMessage: SAFE_MESSAGES.otpTimeout,
};

// Defense in depth: even if the server ever sent something technical by mistake,
// text that looks like a database error, stack trace, file path, or secret is
// never shown.
const TECHNICAL_PATTERN =
  /mongo|mongoose|E11000|ECONN|ENOTFOUND|ETIMEDOUT|node_modules|\.js:\d+|\n\s+at\s|[A-Za-z]:\\|\/(home|usr|var|app|src)\/|undefined|is not a function|cannot read|unexpected token|jsonwebtoken|JsonWebTokenError|TokenExpiredError|validation failed|cast to|\.env|localhost:\d+/i;

function toSafeMessage(status, message) {
  if (status === 429) return SAFE_MESSAGES.tooMany;
  if (status === 502 || status === 503 || status === 504) return SAFE_MESSAGES.unavailable;
  if (status >= 500) return SAFE_MESSAGES.generic;

  // 4xx: the server's own short, plain messages (e.g. "Incorrect email or
  // password.") are fine to show, as long as they don't look technical.
  if (
    typeof message === "string" &&
    message.trim() &&
    message.length <= 200 &&
    !TECHNICAL_PATTERN.test(message)
  ) {
    return message;
  }
  return SAFE_MESSAGES.unprocessed;
}

// Use this in every catch block that shows an error on screen.
export function getUserMessage(err) {
  if (err instanceof UserFacingError) return err.message;
  // Unexpected error: keep details in the browser console only in development.
  if (import.meta.env && import.meta.env.DEV) console.error(err);
  return SAFE_MESSAGES.generic;
}

// Use this in catch blocks for requests that send an OTP email.
export function otpSendErrorMessage(err) {
  if (err instanceof UserFacingError && err.code === "EMAIL_SEND_FAILED") {
    return SAFE_MESSAGES.otpEmailFailed;
  }
  return getUserMessage(err);
}

// The extra timeout options are removed before fetch so they are never passed
// as unsupported RequestInit properties to the browser.
export async function safeFetchJson(url, options) {
  const { timeoutMs, timeoutMessage, ...fetchOptions } = options || {};
  const effectiveTimeout = Number.isFinite(Number(timeoutMs)) && Number(timeoutMs) > 0
    ? Number(timeoutMs)
    : DEFAULT_TIMEOUT_MS;
  let res;
  let timedOut = false;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, effectiveTimeout);

  try {
    // credentials: "include" so the httpOnly session cookie is sent when needed.
    res = await fetch(url, {
      credentials: "include",
      ...fetchOptions,
      signal: controller.signal,
    });
  } catch (networkErr) {
    if (timedOut && typeof timeoutMessage === "string" && timeoutMessage.trim()) {
      throw new UserFacingError(timeoutMessage);
    }
    throw new UserFacingError(SAFE_MESSAGES.offline);
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (parseErr) {
      data = null;
    }
  }

  if (!res.ok) {
    const retryAfter =
      Number(data && data.retryAfterSeconds) ||
      Number(res.headers.get("Retry-After")) ||
      0;
    const code = typeof (data && data.code) === "string" ? data.code : "";
    throw new UserFacingError(
      toSafeMessage(res.status, data && data.error),
      res.status,
      retryAfter,
      code
    );
  }
  if (data === null) {
    throw new UserFacingError(SAFE_MESSAGES.unavailable, res.status);
  }
  return data;
}

/* ---------------- CONSENT CHECKBOX (Privacy Controls) ---------------- */

// "Terms and Conditions" is a clickable link that opens the full, detailed
// terms in a popup (see TermsModal.jsx). onChange receives a boolean.
export function ConsentCheckbox({ checked, onChange }) {
  const [termsOpen, setTermsOpen] = useState(false);

  return (
    <>
      <label className="flex items-start gap-2 px-1 text-[11.5px] leading-snug text-gray-600 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#2E7D32]"
          required
        />
        <span>
          I agree to the{" "}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setTermsOpen(true);
            }}
            className="font-semibold text-[#2E7D32] underline underline-offset-2 hover:text-[#1B5E20] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] rounded-sm"
          >
            Terms and Conditions
          </button>
          . FarmLink may store my name and email to create and manage my
          account. This data is used only for that purpose and is never sold
          or shared with third parties.
        </span>
      </label>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAgree={() => onChange(true)}
      />
    </>
  );
}

/* Note: the user's name/role live only in the server-side session validated
   via the httpOnly cookie (see /api/auth/me). The one exception is the
   optional "Remember Me" checkbox on the login page, which keeps just the
   email address in localStorage (never the password) and removes it as soon
   as the box is unticked (data minimization). */