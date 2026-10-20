import { useState, useEffect } from "react";
import { Mail, ShieldCheck, Check } from "lucide-react";
import {
  Shell,
  Header,
  TextField,
  PasswordField,
  PasswordRules,
  OtpField,
  PrimaryButton,
  ErrorText,
  BackLink,
  getEmailError,
  getPasswordError,
  sanitizeEmail,
  sanitizePassword,
  safeFetchJson,
  getUserMessage,
  otpSendErrorMessage,
  OTP_SEND_OPTIONS,
  API_URL,
} from "./AuthShared";

const RESEND_SECONDS = 60; // wait time before a new OTP can be requested

function postJson(path, body, extraOptions = {}) {
  return safeFetchJson(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...extraOptions,
  });
}

export default function Forgot({ onGoToLogin }) {
  // step = "email" -> "otp" -> "reset" -> "done"
  const [step, setStep] = useState("email");

  /* ---------------- STEP 1: EMAIL ---------------- */
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotEmailError, setForgotEmailError] = useState("");
  const [forgotEmailSubmitting, setForgotEmailSubmitting] = useState(false);

  /* ---------------- STEP 2: OTP ---------------- */
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotOtpError, setForgotOtpError] = useState("");
  const [otpInfo, setOtpInfo] = useState("");
  const [forgotOtpSubmitting, setForgotOtpSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0); // seconds left before "Resend OTP" works

  /* ---------------- STEP 3: NEW PASSWORD ---------------- */
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  // Countdown for the "Resend OTP" button
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const apiEmail = forgotEmail.trim().toLowerCase();

  /* ---------- Step 1: email the OTP ---------- */
  function handleForgotEmailSubmit(e) {
    e.preventDefault();
    setForgotEmailError("");
    const forgotEmailErr = getEmailError(forgotEmail);
    if (forgotEmailErr) {
      setForgotEmailError(forgotEmailErr);
      return;
    }
    setForgotEmailSubmitting(true);
    postJson("/forgot/send-otp", { email: apiEmail }, OTP_SEND_OPTIONS)
      .then(() => {
        setForgotEmailSubmitting(false);
        setForgotOtp("");
        setForgotOtpError("");
        setOtpInfo("");
        setResendIn(RESEND_SECONDS);
        setStep("otp");
      })
      .catch((err) => {
        setForgotEmailSubmitting(false);
        setForgotEmailError(otpSendErrorMessage(err));
      });
  }

  /* ---------- Step 2: resend the OTP ---------- */
  function handleResendOtp() {
    if (resendIn > 0 || resending) return;
    setForgotOtpError("");
    setOtpInfo("");
    setResending(true);
    postJson("/forgot/send-otp", { email: apiEmail }, OTP_SEND_OPTIONS)
      .then(() => {
        setResending(false);
        setForgotOtp("");
        setResendIn(RESEND_SECONDS);
        setOtpInfo("A new code was sent. Check your email inbox and spam folder.");
      })
      .catch((err) => {
        setResending(false);
        setForgotOtpError(otpSendErrorMessage(err));
      });
  }

  /* ---------- Step 2: check the OTP ---------- */
  function handleForgotOtpSubmit(e) {
    e.preventDefault();
    setForgotOtpError("");
    setOtpInfo("");
    if (forgotOtp.length !== 6) {
      setForgotOtpError("Please enter the 6-digit OTP code.");
      return;
    }
    setForgotOtpSubmitting(true);
    postJson("/forgot/verify-otp", { email: apiEmail, otp: forgotOtp })
      .then(() => {
        setForgotOtpSubmitting(false);
        setStep("reset");
      })
      .catch((err) => {
        setForgotOtpSubmitting(false);
        setForgotOtpError(getUserMessage(err));
      });
  }

  /* ---------- Step 3: save the new password ---------- */
  function handleResetSubmit(e) {
    e.preventDefault();
    setResetError("");
    if (!newPassword || !confirmNewPassword) {
      setResetError("Please fill out both fields.");
      return;
    }
    const newPasswordError = getPasswordError(newPassword);
    if (newPasswordError) {
      setResetError(newPasswordError);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Passwords do not match.");
      return;
    }
    setResetSubmitting(true);
    postJson("/forgot/reset-password", {
      email: apiEmail,
      otp: forgotOtp,
      newPassword,
    })
      .then(() => {
        setResetSubmitting(false);
        setNewPassword("");
        setConfirmNewPassword("");
        setStep("done");
      })
      .catch((err) => {
        setResetSubmitting(false);
        setResetError(getUserMessage(err));
      });
  }

  /* ================= STEP 4: DONE ================= */
  if (step === "done") {
    return (
      <Shell>
        <div
          className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: "linear-gradient(90deg, #4CAF50, #2E7D32)" }}
        >
          <Check size={30} color="#fff" strokeWidth={3} />
        </div>
        <h1 className="text-xl font-bold mb-1 tracking-tight text-center text-[#1B5E20]">
          Password updated
        </h1>
        <p className="mb-6 text-center text-[13px] text-gray-500">
          Your password was changed successfully. Log in again with your new password.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onGoToLogin();
          }}
          className="w-full"
        >
          <PrimaryButton>BACK TO LOG IN</PrimaryButton>
        </form>
      </Shell>
    );
  }

  /* ================= STEP 2: OTP ================= */
  if (step === "otp") {
    return (
      <Shell>
        <ShieldCheck size={40} className="mb-3 text-[#2E7D32]" />
        <h1 className="text-xl font-bold mb-1 tracking-tight text-center text-[#1B5E20]">
          Enter OTP
        </h1>
        <p className="mb-1 text-center text-[13px] text-gray-500">
          We sent a 6-digit code to{" "}
          <span className="break-all font-semibold text-[#2E7D32]">
            {forgotEmail || "your email address"}
          </span>
          . The code expires in 5 minutes.
        </p>
        <p className="mb-5 rounded-lg bg-[#F1F8E9] px-3 py-2 text-center text-[12px] text-[#33691E]">
          Check your email <b>inbox</b> and <b>spam</b> folder, then type the code here.
          If no email arrives, you may have entered an email without a FarmLink account.
        </p>

        <form onSubmit={handleForgotOtpSubmit} className="w-full space-y-3.5" noValidate>
          <OtpField value={forgotOtp} onChange={setForgotOtp} />

          {otpInfo && (
            <p className="text-[13px] text-center" style={{ color: "#2E7D32" }}>
              {otpInfo}
            </p>
          )}
          <ErrorText>{forgotOtpError}</ErrorText>

          <PrimaryButton loading={forgotOtpSubmitting} loadingText="VERIFYING...">
            VERIFY OTP
          </PrimaryButton>
        </form>

        <p className="mt-4 text-center text-[12.5px] text-gray-600">
          Didn't get the code?{" "}
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={resendIn > 0 || resending}
            className="font-bold text-[#2E7D32] hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
          >
            {resending
              ? "Sending..."
              : resendIn > 0
              ? `Resend OTP in ${resendIn}s`
              : "Resend OTP"}
          </button>
        </p>

        <BackLink
          onClick={() => {
            setForgotOtpError("");
            setOtpInfo("");
            setStep("email");
          }}
          label="Back"
        />
      </Shell>
    );
  }

  /* ================= STEP 3: NEW PASSWORD ================= */
  if (step === "reset") {
    return (
      <Shell>
        <Header title="Set your new password" />
        <form onSubmit={handleResetSubmit} className="w-full space-y-3.5" noValidate>
          <PasswordField
            value={newPassword}
            onChange={(e) => setNewPassword(sanitizePassword(e.target.value))}
            placeholder="New Password"
            autoComplete="new-password"
            show={showNewPassword}
            onToggle={() => setShowNewPassword((s) => !s)}
          />

          <PasswordRules password={newPassword} />

          <PasswordField
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(sanitizePassword(e.target.value))}
            placeholder="Confirm New Password"
            autoComplete="new-password"
            show={showConfirmNewPassword}
            onToggle={() => setShowConfirmNewPassword((s) => !s)}
          />

          <ErrorText>{resetError}</ErrorText>

          <PrimaryButton loading={resetSubmitting} loadingText="SAVING...">
            RESET PASSWORD
          </PrimaryButton>
        </form>

        <BackLink onClick={onGoToLogin} />
      </Shell>
    );
  }

  /* ================= STEP 1: EMAIL ================= */
  return (
    <Shell>
      <Header title="Enter your email address to reset your password" />
      <form onSubmit={handleForgotEmailSubmit} className="w-full space-y-3.5" noValidate>
        <TextField
          icon={Mail}
          type="email"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(sanitizeEmail(e.target.value))}
          placeholder="Email Address"
        />

        <ErrorText>{forgotEmailError}</ErrorText>

        <PrimaryButton loading={forgotEmailSubmitting} loadingText="SENDING OTP...">
          SEND OTP
        </PrimaryButton>
      </form>

      <BackLink onClick={onGoToLogin} />
    </Shell>
  );
}