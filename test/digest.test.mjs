import test from "node:test";
import assert from "node:assert/strict";
import { eventMatchesSubscription, eventsForUser, isDigestDue } from "../api/_lib/digest.js";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-07-11T15:00:00Z");

test("events match their subscription categories", () => {
  const sub = { hot_new: true, awarded: false, essential: false, iconic: true };
  assert.equal(eventMatchesSubscription({ event_type: "announced" }, sub), true);
  assert.equal(eventMatchesSubscription({ event_type: "awarded" }, sub), false);
  assert.equal(eventMatchesSubscription({ event_type: "captured" }, sub), true);
  assert.equal(eventMatchesSubscription({ event_type: "unknown" }, sub), false);
});

test("daily digests are due after ~a day, not twice a day", () => {
  assert.equal(isDigestDue({ frequency: "daily", last_digest_at: null }, NOW), true);
  assert.equal(isDigestDue({ frequency: "daily", last_digest_at: new Date(NOW - 2 * HOUR).toISOString() }, NOW), false);
  assert.equal(isDigestDue({ frequency: "daily", last_digest_at: new Date(NOW - 23 * HOUR).toISOString() }, NOW), true);
});

test("weekly digests wait roughly a week", () => {
  assert.equal(isDigestDue({ frequency: "weekly", last_digest_at: new Date(NOW - 2 * DAY).toISOString() }, NOW), false);
  assert.equal(isDigestDue({ frequency: "weekly", last_digest_at: new Date(NOW - 7 * DAY).toISOString() }, NOW), true);
  assert.equal(isDigestDue({ frequency: "weekly", last_digest_at: null }, NOW), true);
});

test("eventsForUser windows on last digest and subscription match", () => {
  const events = [
    { id: 1, event_type: "announced", occurred_at: new Date(NOW - 2 * HOUR).toISOString() },
    { id: 2, event_type: "awarded", occurred_at: new Date(NOW - 3 * HOUR).toISOString() },
    { id: 3, event_type: "announced", occurred_at: new Date(NOW - 3 * DAY).toISOString() }
  ];
  const sub = { hot_new: true, awarded: false, essential: false, iconic: false, frequency: "daily", last_digest_at: new Date(NOW - 1 * DAY).toISOString() };
  const matched = eventsForUser(events, sub, NOW);
  assert.deepEqual(matched.map((event) => event.id), [1]);

  const weeklyFirstTimer = { ...sub, frequency: "weekly", last_digest_at: null };
  assert.deepEqual(eventsForUser(events, weeklyFirstTimer, NOW).map((event) => event.id), [1, 3]);
});
