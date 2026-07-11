const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function eventMatchesSubscription(event, subscription) {
  if (event.event_type === "announced") return subscription.hot_new;
  if (event.event_type === "awarded") return subscription.awarded;
  if (event.event_type === "captured") return subscription.essential || subscription.iconic;
  return false;
}

// Daily users are eligible ~once a day, weekly users ~once a week. The
// margins (20h / 6.5d) keep a cron that fires slightly early, or twice,
// from double-sending or permanently drifting the schedule.
export function isDigestDue(subscription, now = new Date()) {
  const last = subscription.last_digest_at ? new Date(subscription.last_digest_at) : null;
  if (!last) return true;
  const elapsed = now.getTime() - last.getTime();
  return subscription.frequency === "weekly" ? elapsed >= 6.5 * DAY : elapsed >= 20 * HOUR;
}

// Events a user has not been digested on yet: everything since their last
// digest, bounded by their frequency window for first-time recipients.
export function eventsForUser(events, subscription, now = new Date()) {
  const windowMs = subscription.frequency === "weekly" ? 7 * DAY : DAY;
  const since = subscription.last_digest_at
    ? new Date(subscription.last_digest_at)
    : new Date(now.getTime() - windowMs);
  return events
    .filter((event) => new Date(event.occurred_at) > since)
    .filter((event) => eventMatchesSubscription(event, subscription))
    .slice(0, 25);
}
