import crypto from "node:crypto";

// Codes are short-lived and single-use; hash them so a database leak does not
// expose live sign-in codes. Keyed with APP_SECRET when available.
export function hashLoginCode(code) {
  const key = process.env.APP_SECRET || "local-dev-secret-change-before-production";
  return crypto.createHmac("sha256", key).update(String(code)).digest("hex");
}

export function codesMatch(candidateHash, storedHash) {
  const a = Buffer.from(String(candidateHash));
  const b = Buffer.from(String(storedHash));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
