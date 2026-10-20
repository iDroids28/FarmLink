import nodemailer from "nodemailer";

export const EMAIL_SEND_FAILED_MESSAGE =
  "We couldn't send the verification email right now. Please try again in a moment.";
export const EMAIL_SEND_FAILED_BODY = {
  error: EMAIL_SEND_FAILED_MESSAGE,
  code: "EMAIL_SEND_FAILED",
};

const MAIL_SEND_TIMEOUT_MS = 30_000;
const PLACEHOLDER_RE = /your-group-gmail|your-google-app-password|change-me|example\.com/i;
// Sender must be Gmail because Gmail SMTP authenticates this address.
const EMAIL_RE = /^[^\s@<>"',;]+@gmail\.com$/i;
// Recipient addresses must match the same format accepted by src/AuthShared.js.
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

function extractSenderAddress(from) {
  const angleAddress = String(from || "").match(/<\s*([^<>]+?)\s*>\s*$/);
  return (angleAddress ? angleAddress[1] : String(from || "")).trim();
}

// Read config at call time so dotenv/import order does not change behavior.
function readConfig() {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = (process.env.SMTP_USER || "").trim().toLowerCase();
  // Google displays App Passwords with spaces; spaces are not part of the secret.
  const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");
  const from = (process.env.SMTP_FROM || "").trim() || user;
  const senderAddress = extractSenderAddress(from).toLowerCase();

  const problems = [];
  if (host.toLowerCase() !== "smtp.gmail.com") {
    problems.push("SMTP_HOST must be smtp.gmail.com");
  }
  if (port !== 587) {
    problems.push("SMTP_PORT must be 587 (STARTTLS)");
  }
  if (!EMAIL_RE.test(user) || PLACEHOLDER_RE.test(user)) {
    problems.push("SMTP_USER must be a real Gmail address");
  }
  if (!/^[a-zA-Z0-9]{16}$/.test(pass) || PLACEHOLDER_RE.test(pass)) {
    problems.push("SMTP_PASS must be a 16-character Google App Password");
  }
  if (
    !from || /[\r\n]/.test(from) || !EMAIL_RE.test(senderAddress) ||
    senderAddress !== user || PLACEHOLDER_RE.test(from)
  ) {
    problems.push("SMTP_FROM must use the authenticated Gmail sender address");
  }

  return { host, port, user, pass, from, problems };
}

/** Returns config status without exposing SMTP credentials. */
export function checkEmailConfig() {
  const { problems } = readConfig();
  return { ok: problems.length === 0, problems };
}

/** Log-safe SMTP error: no raw message, recipient, OTP, or credential values. */
export function describeMailError(err) {
  if (err instanceof EmailConfigError) {
    return `Email configuration error: ${err.problems.join("; ")}`;
  }
  const name = typeof err?.name === "string" ? err.name : "Error";
  const code = typeof err?.code === "string" ? err.code.slice(0, 40) : "-";
  const responseCode = Number.isFinite(Number(err?.responseCode))
    ? String(Number(err.responseCode))
    : "-";
  return `SMTP delivery failed (name=${name.slice(0, 40)}, code=${code}, responseCode=${responseCode})`;
}

function createTransport(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: 587,
    secure: false,      // STARTTLS, not implicit TLS
    requireTLS: true,   // fail if STARTTLS is unavailable
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
}

async function sendOtpEmail({ to, subject, heading, code, minutes, footer }) {
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

  const cfg = readConfig();
  if (cfg.problems.length) throw new EmailConfigError(cfg.problems);

  const transport = createTransport(cfg);
  let timeoutId;
  try {
    const text =
      `${heading}\n\nYour FarmLink verification code is: ${code}\n\n` +
      `It expires in ${minutes} minutes. ${footer}`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#333">
        <h2 style="color:#2E7D32;margin:0 0 12px">FarmLink</h2>
        <p>${heading}</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#2E7D32;margin:16px 0">${code}</p>
        <p style="font-size:13px;color:#666">It expires in ${minutes} minutes. ${footer}</p>
        <p style="font-size:12px;color:#777">Never share this code with anyone.</p>
      </div>`;

    const sendPromise = transport.sendMail({
      from: cfg.from,
      to: to.trim().toLowerCase(),
      subject,
      text,
      html,
    });
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        const err = new Error("SMTP delivery timed out");
        err.code = "SMTP_SEND_TIMEOUT";
        reject(err);
      }, MAIL_SEND_TIMEOUT_MS);
    });
    const info = await Promise.race([sendPromise, timeoutPromise]);

    // This email has a single recipient. Nodemailer must report at least one
    // accepted recipient and no rejected/pending recipients.
    const accepted = Array.isArray(info?.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info?.rejected) ? info.rejected : [];
    const pending = Array.isArray(info?.pending) ? info.pending : [];
    if (accepted.length < 1 || rejected.length > 0 || pending.length > 0) {
      const err = new Error("SMTP recipient was not accepted");
      err.code = "SMTP_RECIPIENT_NOT_ACCEPTED";
      throw err;
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    // A fresh transport is used per low-volume OTP email, so it can be closed
    // safely without interrupting another recipient's send in this process.
    try {
      transport.close();
    } catch {
      // Do not mask the original delivery result/error during cleanup.
    }
  }
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
    heading: "Enter this code to finish signing in to your FarmLink account.",
    footer: "If you did not try to log in, change your password and secure your account.",
  });
}

export function sendPasswordChangeOtpEmail(to, code, minutes = 10) {
  return sendOtpEmail({
    to,
    code,
    minutes,
    subject: "Confirm your FarmLink password change",
    heading: "Enter this code to confirm the password change you requested.",
    footer: "If you did not request a password change, do not enter this code and secure your account.",
  });
}

// In-process locks prevent duplicate sends from concurrent requests in this
// server instance. The caller must always release using the matching token.
const locks = new Map();
export function acquireSendLock(key) {
  if (locks.has(key)) return null;
  const token = Symbol(key);
  locks.set(key, token);
  return token;
}
export function releaseSendLock(key, token) {
  if (locks.get(key) === token) locks.delete(key);
}
