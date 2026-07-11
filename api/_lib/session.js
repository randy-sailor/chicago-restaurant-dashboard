import crypto from "node:crypto";

const COOKIE_NAME = "crd_session";

function secret() {
  if (process.env.APP_SECRET) return process.env.APP_SECRET;
  if (process.env.NODE_ENV === "production") {
    throw Object.assign(new Error("APP_SECRET is not configured."), { statusCode: 503 });
  }
  return "local-dev-secret-change-before-production";
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(payload) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a, b) {
  const bufferA = Buffer.from(String(a));
  const bufferB = Buffer.from(String(b));
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

export function createSessionCookie(user) {
  const payload = base64url(JSON.stringify({
    id: user.id,
    email: user.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 180
  }));
  const token = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 180}${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readSession(req) {
  const cookies = req.headers.cookie || "";
  const raw = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!raw) return null;
  const token = raw.slice(COOKIE_NAME.length + 1);
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!session.exp || session.exp < Date.now()) return null;
    return { id: session.id, email: session.email };
  } catch {
    return null;
  }
}

export function requireSession(req) {
  const session = readSession(req);
  if (!session) {
    throw Object.assign(new Error("Authentication required."), { statusCode: 401 });
  }
  return session;
}
