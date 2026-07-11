import { query } from "../_lib/db.js";
import { sendEmail } from "../_lib/email.js";
import { restaurantDigestEmail } from "../_lib/emailTemplates.js";
import { handleError, sendJson } from "../_lib/http.js";

function requireCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const vercelCron = req.headers["x-vercel-cron"] === "1";
  if (!vercelCron && supplied !== expected) {
    throw Object.assign(new Error("Forbidden."), { statusCode: 403 });
  }
}

function eventMatchesSubscription(event, subscription) {
  if (event.event_type === "announced") return subscription.hot_new;
  if (event.event_type === "awarded") return subscription.awarded;
  if (event.event_type === "captured") return subscription.essential || subscription.iconic;
  return false;
}

export default async function handler(req, res) {
  try {
    requireCronSecret(req);

    const eventsResult = await query(
      `select *
       from restaurant_events
       where emailed_at is null
       order by occurred_at desc
       limit 25`
    );
    const events = eventsResult.rows;
    if (events.length === 0) {
      sendJson(res, 200, { sent: 0, events: 0 });
      return;
    }

    const usersResult = await query(
      `select u.email, s.*
       from users u
       join subscriptions s on s.user_id = u.id`
    );

    let sent = 0;
    for (const user of usersResult.rows) {
      const matching = events.filter((event) => eventMatchesSubscription(event, user));
      if (matching.length === 0) continue;

      const email = restaurantDigestEmail(matching);

      await sendEmail({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html
      });
      sent += 1;
    }

    await query(
      `update restaurant_events set emailed_at = now() where id = any($1::bigint[])`,
      [events.map((event) => event.id)]
    );

    sendJson(res, 200, { sent, events: events.length });
  } catch (error) {
    handleError(res, error);
  }
}
