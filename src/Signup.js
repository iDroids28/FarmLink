import { useEffect, useState } from "react";
import { Mail, User, ShieldCheck, X, Check } from "lucide-react";
import {
  Shell,
  Header,
  TextField,
  PasswordField,
  PasswordRules,
  OtpField,
  PrimaryButton,
  ErrorText,
  ConsentCheckbox,
  getEmailError,
  getPasswordError,
  safeFetchJson,
  getUserMessage,
  sanitizeName,
  sanitizeEmail,
  sanitizePassword,
  API_URL,
} from "./AuthShared";

/* ---------------- OTP EMAIL HELPERS ----------------
   Longer timeout ONLY for requests that send an OTP email (the server gives up
   on a slow email after 30s). If AuthShared's safeFetchJson does not support
   these options, they are simply ignored and nothing breaks. */

const OTP_SEND_OPTIONS = {
  timeoutMs: 45000,
  timeoutMessage:
    "Sending the email took too long. Please try again, and use the newest code if more than one email arrives.",
};

const OTP_EMAIL_FAILED_UI =
  "We couldn't send the verification email right now. Please try again in a moment.";

function otpSendErrorMessage(err) {
  if (err && err.code === "EMAIL_SEND_FAILED") return OTP_EMAIL_FAILED_UI;
  return getUserMessage(err);
}

/* ---------------- VERIFY-CODE POPUP ---------------- */

function VerifyCodeModal({ email, resendSeconds, onVerified, onCancel }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(resendSeconds);

  // Counts down the "Resend code" wait.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  // Esc closes the popup.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submitting, onCancel]);

  function handleVerify(e) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setInfo("");
    if (code.length !== 6) {
      setError("Please enter the 6-digit code.");
      return;
    }
    setSubmitting(true);
    safeFetchJson(`${API_URL}/signup/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    })
      .then(() => {
        setSubmitting(false);
        onVerified();
      })
      .catch((err) => {
        setSubmitting(false);
        setError(getUserMessage(err));
        setCode("");
      });
  }

  function handleResend() {
    if (resending || cooldown > 0) return;
    setError("");
    setInfo("");
    setResending(true);
    safeFetchJson(`${API_URL}/signup/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      ...OTP_SEND_OPTIONS,
    })
      .then((data) => {
        setResending(false);
        setCode("");
        setCooldown(Number(data?.resendAfterSeconds) || 30);
        setInfo("A new code was sent. Check your Gmail inbox and spam folder.");
      })
      .catch((err) => {
        setResending(false);
        if (err?.retryAfter) setCooldown(err.retryAfter);
        setError(otpSendErrorMessage(err));
      });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="verify-title"
    >
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-3xl bg-white px-7 py-8 shadow-2xl">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: "linear-gradient(90deg, #8BC34A, #4CAF50, #2E7D32)" }}
        />

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="flex flex-col items-center">
          <ShieldCheck size={40} className="mb-3 text-[#2E7D32]" />
          <h2 id="verify-title" className="mb-1 text-center text-xl font-bold tracking-tight text-[#1B5E20]">
            Verify your email
          </h2>
          <p className="mb-1 text-center text-[13px] text-gray-500">
            We sent a 6-digit code to{" "}
            <span className="break-all font-semibold text-[#2E7D32]">{email}</span>
          </p>
          <p className="mb-5 rounded-lg bg-[#F1F8E9] px-3 py-2 text-center text-[12px] text-[#33691E]">
            Check your Gmail <b>inbox</b> and <b>spam</b> folder, then type the code here.
          </p>

          <form onSubmit={handleVerify} className="w-full space-y-3.5" noValidate>
            <OtpField value={code} onChange={setCode} />

            <ErrorText>{error}</ErrorText>
            {info && !error && (
              <p className="text-center text-[13px]" style={{ color: "#2E7D32" }}>
                {info}
              </p>
            )}

            <PrimaryButton loading={submitting} loadingText="VERIFYING...">
              VERIFY & CREATE ACCOUNT
            </PrimaryButton>
          </form>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            className="mt-4 text-[12.5px] font-semibold text-[#2E7D32] hover:text-[#1B5E20] disabled:cursor-not-allowed disabled:text-gray-400"
          >
            {resending
              ? "Sending..."
              : cooldown > 0
              ? `Resend code in ${cooldown}s`
              : "Resend code"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="mt-2 text-[12.5px] text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- ACCOUNT CREATED POPUP ---------------- */

function AccountCreatedModal({ onOk }) {
  // Esc also acts as "OK". Enter works through the focused OK button.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onOk();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOk]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="created-title"
    >
      <div className="relative w-full max-w-[340px] overflow-hidden rounded-3xl bg-white px-7 py-8 shadow-2xl">
        <div
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: "linear-gradient(90deg, #8BC34A, #4CAF50, #2E7D32)" }}
        />

        <div className="flex flex-col items-center">
          <div
            className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
          >
            <Check size={30} color="#fff" strokeWidth={3} />
          </div>
          <h2
            id="created-title"
            className="mb-1 text-center text-xl font-bold tracking-tight text-[#1B5E20]"
          >
            Account created
          </h2>
          <p className="mb-5 text-center text-[13px] text-gray-500">
            Your account was successfully created.
          </p>
          <button
            type="button"
            autoFocus
            onClick={onOk}
            className="rounded-full px-8 py-2 text-[13px] font-bold tracking-wide text-white transition hover:brightness-110 active:scale-[0.99]"
            style={{
              background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
              boxShadow: "0 6px 14px rgba(46,125,50,0.30)",
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- SIGN UP PAGE ---------------- */

export default function Signup({ onGoToLogin }) {
  const [fullName, setFullName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [signupError, setSignupError] = useState("");
  const [signupSubmitting, setSignupSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  // The code popup: null = closed, otherwise { email, resendSeconds }
  const [verify, setVerify] = useState(null);

  // true after the code is verified and the account exists
  const [created, setCreated] = useState(false);

  function handleSignupSubmit(e) {
    e.preventDefault();
    if (signupSubmitting) return;
    setSignupError("");
    if (!fullName.trim()) {
      setSignupError("Please enter your full name.");
      return;
    }
    const cleanEmail = signupEmail.trim().toLowerCase();
    const signupEmailError = getEmailError(cleanEmail);
    if (signupEmailError) {
      setSignupError(signupEmailError);
      return;
    }
    if (!signupPassword || !signupConfirmPassword) {
      setSignupError("Please enter and confirm your password.");
      return;
    }
    const signupPasswordError = getPasswordError(signupPassword);
    if (signupPasswordError) {
      setSignupError(signupPasswordError);
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (!consent) {
      setSignupError("Please read and agree to the Terms and Conditions to continue.");
      return;
    }
    setSignupSubmitting(true);
    safeFetchJson(`${API_URL}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fullName.trim(),
        email: cleanEmail,
        password: signupPassword,
        consent: true,
      }),
      ...OTP_SEND_OPTIONS,
    })
      .then((data) => {
        setSignupSubmitting(false);
        // The server emailed the code — open the code popup.
        setVerify({
          email: data?.email || cleanEmail,
          resendSeconds: Number(data?.resendAfterSeconds) || 30,
        });
      })
      .catch((err) => {
        setSignupSubmitting(false);
        setSignupError(otpSendErrorMessage(err));
      });
  }

  return (
    <>
      <Shell>
        <Header title="Create your account" />
        <form onSubmit={handleSignupSubmit} className="w-full space-y-3.5" noValidate>
          <TextField
            icon={User}
            type="text"
            value={fullName}
            onChange={(e) => setFullName(sanitizeName(e.target.value))}
            placeholder="Full Name"
          />
          <TextField
            icon={Mail}
            type="email"
            value={signupEmail}
            onChange={(e) => setSignupEmail(sanitizeEmail(e.target.value))}
            placeholder="Email Address"
          />

          <PasswordField
            value={signupPassword}
            onChange={(e) => setSignupPassword(sanitizePassword(e.target.value))}
            placeholder="Password"
            autoComplete="new-password"
            show={showSignupPassword}
            onToggle={() => setShowSignupPassword((s) => !s)}
          />

          <PasswordRules password={signupPassword} />

          <PasswordField
            value={signupConfirmPassword}
            onChange={(e) => setSignupConfirmPassword(sanitizePassword(e.target.value))}
            placeholder="Confirm Password"
            autoComplete="new-password"
            show={showSignupConfirmPassword}
            onToggle={() => setShowSignupConfirmPassword((s) => !s)}
          />

          <ConsentCheckbox checked={consent} onChange={setConsent} />

          <ErrorText>{signupError}</ErrorText>

          <PrimaryButton loading={signupSubmitting} loadingText="SENDING CODE...">
            SIGN UP
          </PrimaryButton>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-gray-600">
          Already have an account?{" "}
          <button
            type="button"
            onClick={onGoToLogin}
            className="font-bold text-[#2E7D32] hover:underline"
          >
            Log In
          </button>
        </p>
      </Shell>

      {verify && (
        <VerifyCodeModal
          email={verify.email}
          resendSeconds={verify.resendSeconds}
          onVerified={() => {
            setVerify(null);
            setCreated(true); // show the success popup first
          }}
          onCancel={() => setVerify(null)}
        />
      )}

      {created && (
        <AccountCreatedModal
          onOk={() => {
            setCreated(false);
            onGoToLogin(); // go to Log In only after the user presses OK
          }}
        />
      )}
    </>
  );
}