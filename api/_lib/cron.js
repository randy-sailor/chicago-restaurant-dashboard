import crypto from "node:crypto";

// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically when
// the CRON_SECRET environment variable is set, so bearer-token auth covers
// both scheduled and manual invocations. Never trust the x-vercel-cron
// header: external callers can set it.
export function requireCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw Object.assign(new Error("CRON_SECRET is not configured."), { statusCode: 503 });
  }
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") || "";
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  const matches = suppliedBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
  if (!matches) {
    throw Object.assign(new Error("Forbidden."), { statusCode: 403 });
  }
}
