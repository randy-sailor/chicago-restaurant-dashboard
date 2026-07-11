import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCookie, readSession } from "../api/_lib/session.js";

function requestWithCookie(cookieHeader) {
  return { headers: { cookie: cookieHeader } };
}

function cookieValue(setCookie) {
  return setCookie.split(";")[0];
}

test("session cookie round-trips id and email", () => {
  const cookie = createSessionCookie({ id: "user-1", email: "a@example.com" });
  const session = readSession(requestWithCookie(cookieValue(cookie)));
  assert.deepEqual(session, { id: "user-1", email: "a@example.com" });
});

test("tampered payload is rejected", () => {
  const cookie = cookieValue(createSessionCookie({ id: "user-1", email: "a@example.com" }));
  const [name, token] = cookie.split("=");
  const [payload, signature] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ id: "user-2", email: "b@example.com", exp: Date.now() + 10000 })).toString("base64url");
  assert.equal(readSession(requestWithCookie(`${name}=${forged}.${signature}`)), null);
  assert.equal(readSession(requestWithCookie(`${name}=${payload}.AAAA`)), null);
});

test("garbage and missing cookies are rejected", () => {
  assert.equal(readSession(requestWithCookie("")), null);
  assert.equal(readSession(requestWithCookie("crd_session=not-a-token")), null);
  assert.equal(readSession({ headers: {} }), null);
});

test("session cookie is HttpOnly, SameSite=Lax, and long-lived", () => {
  const cookie = createSessionCookie({ id: "user-1", email: "a@example.com" });
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=15552000/);
});
