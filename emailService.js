const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const MAIL_SEND_TIMEOUT_MS = 30_000;

export const EMAIL_SEND_FAILED_MESSAGE =
  "We couldn't send the verification email right now. Please try again in a moment.";

export const EMAIL_SEND_FAILED_BODY = {
  error: EMAIL_SEND_FAILED_MESSAGE,
  code: "EMAIL_SEND_FAILED",
};

// Match the email format used by src/AuthShared.js, including domains such as
// phinmaed.com. This validates the format, not whether the mailbox exists.
const EMAIL_ADDRESS_RE =
  /^(?=[^@]{1,64}@)[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function isValidEmailAddress(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    !/[\r\n]/.test(value) &&
    EMAIL_ADDRESS_RE.test(value)
  );
}

export class EmailConfigError extends Error {
  constructor(problems) {
    super(`Email is not configured: ${problems.join("; ")}`);
    this.name = "EmailConfigError";
    this.problems = problems;
  }
}

// Read environment variables when called, not during module import.
// Never log or return the API key itself.
function readConfig() {
  const apiKey = (process.env.BREVO_API_KEY || "").trim();
  const senderEmail = (process.env.BREVO_SENDER_EMAIL || "")
    .trim()
    .toLowerCase();
  const senderName = (process.env.BREVO_SENDER_NAME || "FarmLink").trim();

  const problems = [];

  if (
    !apiKey ||
    /^(your-brevo-api-key|replace-with-your-api-key|change-me|placeholder)$/i.test(
      apiKey,
    )
  ) {
    problems.push(
      "BREVO_API_KEY must be configured with your Brevo API key",
    );
  }

  if (!isValidEmailAddress(senderEmail)) {
    problems.push("BREVO_SENDER_EMAIL must be a valid email address");
  }

  if (!senderName || /[\r\n]/.test(senderName) || senderName.length > 100) {
    problems.push("BREVO_SENDER_NAME must be a valid sender name");
  }

  return { apiKey, senderEmail, senderName, problems };
}

/** Returns configuration status without exposing credentials. */
export function checkEmailConfig() {
  const { problems } = readConfig();
  return { ok: problems.length === 0, problems };
}

/** Safe diagnostic summary; do not log raw provider messages or credentials. */
export function describeMailError(err) {
  if (err instanceof EmailConfigError) {
    return `Email configuration error: ${err.problems.join("; ")}`;
  }

  const name =
    typeof err?.name === "string" ? err.name.slice(0, 40) : "Error";
  const code =
    typeof err?.code === "string" ? err.code.slice(0, 40) : "-";
  const statusCode = Number.isInteger(Number(err?.statusCode))
    ? String(Number(err.statusCode))
    : "-";

  return `Brevo delivery failed (name=${name}, code=${code}, status=${statusCode})`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendOtpEmail({
  to,
  subject,
  heading,
  code,
  minutes,
  footer,
}) {
  if (
    typeof to !== "string" ||
    !isValidEmailAddress(to.trim()) ||
    /[\r\n]/.test(to)
  ) {
    throw new Error("Invalid recipient address");
  }

  if (!/^\d{6}$/.test(String(code))) {
    throw new Error("Invalid OTP format");
  }

  const expiryMinutes = Number(minutes);
  if (!Number.isFinite(expiryMinutes) || expiryMinutes <= 0) {
    throw new Error("Invalid OTP expiration time");
  }

  const cfg = readConfig();

  if (cfg.problems.length > 0) {
    throw new EmailConfigError(cfg.problems);
  }

  const safeHeading = escapeHtml(heading);
  const safeFooter = escapeHtml(footer);
  const safeCode = escapeHtml(code);
  const safeMinutes = escapeHtml(expiryMinutes);

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#333">
      <h2 style="color:#2E7D32;margin:0 0 12px">FarmLink</h2>
      <p>${safeHeading}</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#2E7D32;margin:16px 0">${safeCode}</p>
      <p style="font-size:13px;color:#666">It expires in ${safeMinutes} minutes. ${safeFooter}</p>
      <p style="font-size:12px;color:#777">Never share this code with anyone.</p>
    </div>
  `;

  let response;

  try {
    response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": cfg.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: cfg.senderName,
          email: cfg.senderEmail,
        },
        to: [{ email: to.trim().toLowerCase() }],
        subject,
        htmlContent,
      }),
      signal: AbortSignal.timeout(MAIL_SEND_TIMEOUT_MS),
    });
  } catch (err) {
    const wrappedError = new Error("Could not reach the email provider");

    wrappedError.code =
      err?.name === "TimeoutError" || err?.name === "AbortError"
        ? "BREVO_SEND_TIMEOUT"
        : "BREVO_NETWORK_ERROR";

    throw wrappedError;
  }

  if (!response.ok) {
    const err = new Error(
      "Brevo rejected the transactional email request",
    );

    err.code = "BREVO_API_ERROR";
    err.statusCode = response.status;

    throw err;
  }

  // A successful API response means the request was accepted by Brevo.
  // It does not guarantee inbox delivery.
  return undefined;
}

export function sendSignupOtpEmail(to, code, minutes = 10) {
  return sendOtpEmail({
    to,
    code,
    minutes,
    subject: "Your FarmLink verification code",
    heading: "Use this code to finish creating your FarmLink account.",
    footer: "If you did not sign up, you can ignore this email.",
  });
}

export function sendPasswordResetOtpEmail(to, code, minutes = 5) {
  return sendOtpEmail({
    to,
    code,
    minutes,
    subject: "Your FarmLink password reset code",
    heading: "Use this code to reset your FarmLink password.",
    footer: "If you did not request it, you can ignore this email.",
  });
}

export function sendLoginOtpEmail(to, code, minutes = 10) {
  return sendOtpEmail({
    to,
    code,
    minutes,
    subject: "Your FarmLink login verification code",
    heading:
      "Enter this code to finish signing in to your FarmLink account.",
    footer:
      "If you did not try to log in, change your password and secure your account.",
  });
}

export function sendPasswordChangeOtpEmail(to, code, minutes = 10) {
  return sendOtpEmail({
    to,
    code,
    minutes,
    subject: "Confirm your FarmLink password change",
    heading:
      "Enter this code to confirm the password change you requested.",
    footer:
      "If you did not request a password change, do not enter this code and secure your account.",
  });
}

// In-process locks prevent duplicate sends from concurrent requests
// in this server instance. The caller must release using the matching token.
const locks = new Map();

export function acquireSendLock(key) {
  if (locks.has(key)) return null;

  const token = Symbol(key);
  locks.set(key, token);

  return token;
}

export function releaseSendLock(key, token) {
  if (locks.get(key) === token) {
    locks.delete(key);
  }
}