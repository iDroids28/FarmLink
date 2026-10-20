import { useState, useEffect } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import {
  Shell,
  Header,
  TextField,
  PasswordField,
  OtpField,
  OTP_SEND_OPTIONS,
  PrimaryButton,
  ErrorText,
  BackLink,
  getEmailError,
  sanitizeEmail,
  safeFetchJson,
  getUserMessage,
  API_URL,
} from "./AuthShared";

/* LOGIN VALIDATION: email must be valid; password only has to be present.
   The server decides whether the credentials are correct. */

const MAX_PASSWORD_LENGTH = 128; // same cap the server enforces

function removeSpaces(value) {
  return (value || "").replace(/\s/g, "");
}

/* ---------------- Remember Me (email only, never the password) ---------------- */

const REMEMBERED_EMAIL_KEY = "farmlink_remembered_email";

function readRememberedEmail() {
  try {
    return sanitizeEmail(window.localStorage.getItem(REMEMBERED_EMAIL_KEY) || "");
  } catch (e) {
    return "";
  }
}
function saveRememberedEmail(value) {
  try {
    window.localStorage.setItem(REMEMBERED_EMAIL_KEY, value);
  } catch (e) {
    /* convenience only */
  }
}
function clearRememberedEmail() {
  try {
    window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
  } catch (e) {
    /* ignore */
  }
}

/* ---------------- Lockout countdown ----------------
   The server is the real lock. This only remembers the end time so a page
   refresh keeps the form disabled and the countdown running. */

const LOCK_KEY = "farmlink_login_lock_until";
const DEFAULT_LOCK_SECONDS = 60; // used if the server gives no time (e.g. rate limit)

function readLockUntil() {
  try {
    const v = Number(window.localStorage.getItem(LOCK_KEY));
    return v > Date.now() ? v : 0;
  } catch (e) {
    return 0;
  }
}
function saveLockUntil(ts) {
  try {
    window.localStorage.setItem(LOCK_KEY, String(ts));
  } catch (e) {
    /* ignore */
  }
}
function clearLockUntil() {
  try {
    window.localStorage.removeItem(LOCK_KEY);
  } catch (e) {
    /* ignore */
  }
}
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Login({ onLogin, onGoToSignup, onGoToForgot, onGoToHome }) {
  const [email, setEmail] = useState(() => readRememberedEmail());
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(() => readRememberedEmail() !== "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const [lockedUntil, setLockedUntil] = useState(() => readLockUntil());
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secondsLeft > 0;

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const id = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockedUntil) {
        setLockedUntil(0);
        clearLockUntil();
        setError("");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  function startLock(seconds) {
    const until = Date.now() + (seconds > 0 ? seconds : DEFAULT_LOCK_SECONDS) * 1000;
    saveLockUntil(until);
    setNow(Date.now());
    setLockedUntil(until);
    setPassword("");
    setError("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (submitting || locked) return;
    setError("");

    const cleanEmail = email.trim().toLowerCase();

    const emailError = getEmailError(cleanEmail);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      setError("Incorrect email or password.");
      return;
    }

    setSubmitting(true);
    safeFetchJson(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: cleanEmail, password, remember }),
      ...OTP_SEND_OPTIONS,
    })
      .then((data) => {
        setSubmitting(false);
        if (data?.requiresTwoFactor === true && data?.challengeId) {
          setPassword("");
          setOtpCode("");
          setError("");
          setTwoFactorChallenge(data);
          setResendIn(Number(data.resendAfterSeconds) || 30);
          if (remember) saveRememberedEmail(cleanEmail);
          else clearRememberedEmail();
          return;
        }
        if (!data || !data.user) {
          throw new Error("Login response had no user");
        }
        clearLockUntil();
        if (remember) saveRememberedEmail(cleanEmail);
        else clearRememberedEmail();
        onLogin?.({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role || "user",
          twoFactorEnabled: data.user.twoFactorEnabled === true,
        });
      })
      .catch((err) => {
        setSubmitting(false);
        setPassword("");
        // 423 = account locked, 429 = too many requests from this connection.
        if (err && (err.status === 423 || err.status === 429)) {
          startLock(err.retryAfter);
          return;
        }
        setError(getUserMessage(err));
      });
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    if (otpBusy || !twoFactorChallenge) return;
    setError("");
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    setOtpBusy(true);
    try {
      const data = await safeFetchJson(`${API_URL}/login/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: twoFactorChallenge.challengeId, code: otpCode }),
      });
      if (!data?.user) throw new Error("Login response had no user");
      setTwoFactorChallenge(null);
      setOtpCode("");
      clearLockUntil();
      onLogin?.({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role || "user",
        twoFactorEnabled: data.user.twoFactorEnabled === true,
      });
    } catch (err) {
      setError(getUserMessage(err));
      setOtpCode("");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleResendOtp() {
    if (!twoFactorChallenge || resendingOtp || resendIn > 0) return;
    setError("");
    setResendingOtp(true);
    try {
      const data = await safeFetchJson(`${API_URL}/login/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: twoFactorChallenge.challengeId }),
        ...OTP_SEND_OPTIONS,
      });
      setResendIn(Number(data?.resendAfterSeconds) || 30);
      setOtpCode("");
      setError("");
    } catch (err) {
      if (err?.retryAfter) setResendIn(err.retryAfter);
      setError(getUserMessage(err));
    } finally {
      setResendingOtp(false);
    }
  }

  const shownError = locked
    ? `Too many attempts. Please try again in ${formatTime(secondsLeft)}.`
    : error;

  if (twoFactorChallenge) {
    return (
      <Shell>
        <ShieldCheck size={40} className="mb-3 text-[#2E7D32]" />
        <h1 className="text-xl font-bold mb-1 tracking-tight text-center text-[#1B5E20]">Verify your login</h1>
        <p className="mb-2 text-center text-[13px] text-gray-500">
          We sent a 6-digit code to <b className="break-all text-[#2E7D32]">{twoFactorChallenge.email || "your registered email"}</b>.
          Enter it to finish signing in. The code expires in 10 minutes.
        </p>
        <form onSubmit={handleVerifyOtp} className="w-full space-y-3.5" noValidate>
          <OtpField value={otpCode} onChange={setOtpCode} />
          <ErrorText>{error}</ErrorText>
          <PrimaryButton loading={otpBusy} loadingText="VERIFYING...">VERIFY & LOG IN</PrimaryButton>
        </form>
        <button
          type="button"
          onClick={handleResendOtp}
          disabled={resendingOtp || resendIn > 0}
          className="mt-4 text-[12.5px] font-semibold text-[#2E7D32] disabled:cursor-not-allowed disabled:text-gray-400"
        >
          {resendingOtp ? "Sending..." : resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
        </button>
        <button
          type="button"
          onClick={() => { setTwoFactorChallenge(null); setOtpCode(""); setError(""); setPassword(""); }}
          className="mt-3 text-[12.5px] text-gray-500 hover:text-gray-700"
        >
          Back to login
        </button>
      </Shell>
    );
  }

  return (
    <Shell>
      <Header />
      <form onSubmit={handleSubmit} className="w-full space-y-3.5 mt-3" noValidate>
        <TextField
          icon={Mail}
          type="email"
          value={email}
          onChange={(e) => setEmail(sanitizeEmail(e.target.value))}
          placeholder="Email Address"
          name="email"
          autoComplete="username"
          aria-label="Email address"
          disabled={locked}
        />

        <PasswordField
          value={password}
          onChange={(e) => setPassword(removeSpaces(e.target.value))}
          placeholder="Password"
          name="password"
          autoComplete="current-password"
          show={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
          disabled={locked}
        />

        <div role="alert" aria-live="polite">
          <ErrorText>{shownError}</ErrorText>
        </div>

        <div className="flex items-center justify-between px-1 pt-1">
          <label
            className="flex items-center gap-1.5 text-[12.5px] text-gray-600 cursor-pointer select-none"
            title="Stay logged in for 7 days and remember your email on this device"
          >
            <input
              type="checkbox"
              checked={remember}
              disabled={locked}
              onChange={(e) => {
                setRemember(e.target.checked);
                if (!e.target.checked) clearRememberedEmail();
              }}
              className="h-3.5 w-3.5 accent-[#2E7D32]"
            />
            Remember Me
          </label>
          <button
            type="button"
            onClick={onGoToForgot}
            className="text-[12.5px] font-semibold"
            style={{ color: "#D32F2F" }}
          >
            Forgot Password?
          </button>
        </div>

        <PrimaryButton loading={submitting} loadingText="LOGGING IN..." disabled={locked}>
          {locked ? `TRY AGAIN IN ${formatTime(secondsLeft)}` : "LOG IN"}
        </PrimaryButton>
      </form>

      <p className="mt-5 text-center text-[12.5px] text-gray-600">
        Don't have an account?{" "}
        <button
          type="button"
          onClick={onGoToSignup}
          className="font-bold text-[#2E7D32] hover:underline"
        >
          Sign Up
        </button>
      </p>

      {onGoToHome && <BackLink onClick={onGoToHome} label="Back to Home" />}
    </Shell>
  );
}