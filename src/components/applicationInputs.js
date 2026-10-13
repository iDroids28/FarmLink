/* Shared input rules for the Farmer and Business / Buyer application forms.
   KEEP THESE REGEXES IDENTICAL to the ones in roleApplicationRoutes.js. */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^(?:\+63|0)9\d{9}$/;
// Letters (any alphabet), spaces, hyphens, apostrophes. Must start with a letter.
export const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' \u2019-]*$/u;
// Free text for "Other" choices: letters/numbers plus a few common marks.
export const OTHER_RE = /^[\p{L}\p{N}\p{M}][\p{L}\p{N}\p{M} '\u2019&\/.,()-]*$/u;
const HAS_LETTER = /\p{L}/u;

// While typing or pasting: keep digits, and "+" only as the first character.
//   09XXXXXXXXX (11 digits)  or  +639XXXXXXXXX (+ and 12 digits)
export function cleanMobile(raw) {
  const s = String(raw);
  const plus = s.trimStart().startsWith("+");
  return (plus ? "+" : "") + s.replace(/\D/g, "").slice(0, plus ? 12 : 11);
}

// While typing or pasting: drop numbers and symbols a name cannot contain.
export function cleanName(raw) {
  return String(raw).replace(/[^\p{L}\p{M}' \u2019-]/gu, "").slice(0, 100);
}

export const isValidMobile = (v) => MOBILE_RE.test(String(v).replace(/[\s-]/g, ""));
export const isValidName = (v) => {
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length >= 2 && s.length <= 100 && NAME_RE.test(s) && HAS_LETTER.test(s);
};
export const isValidOther = (v) => {
  const s = String(v).trim().replace(/\s+/g, " ");
  return s.length >= 2 && s.length <= 60 && OTHER_RE.test(s) && HAS_LETTER.test(s);
};