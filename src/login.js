import { useState, useEffect } from "react";
import { Mail } from "lucide-react";
import {
  Shell,
  Header,
  TextField,
  PasswordField,
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

  const [lockedUntil, setLockedUntil] = useState(() => readLockUntil());
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((lockedUntil - now) / 1000));
  const locked = secondsLeft > 0;

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
    })
      .then((data) => {
        if (!data || !data.user) {
          throw new Error("Login response had no user");
        }
        setSubmitting(false);
        clearLockUntil();
        if (remember) saveRememberedEmail(cleanEmail);
        else clearRememberedEmail();
        onLogin?.({
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role || "user",
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

  const shownError = locked
    ? `Too many attempts. Please try again in ${formatTime(secondsLeft)}.`
    : error;

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