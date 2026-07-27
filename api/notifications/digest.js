import { query } from "../_lib/db.js";
import { sendEmail } from "../_lib/email.js";
import { restaurantDigestEmail } from "../_lib/emailTemplates.js";
import { handleError, sendJson } from "../_lib/http.js";
import { requireCronSecret } from "../_lib/cron.js";
import { eventsForUser, isDigestDue } from "../_lib/digest.js";
import { runHotPickSends } from "../_lib/hotPickSender.js";

export default async function handler(req, res) {
  try {
    requireCronSecret(req);

    const eventsResult = await query(
      `select *
       from restaurant_events
       where occurred_at > now() - interval '7 days'
       order by occurred_at desc
       limit 200`
    );
    const events = eventsResult.rows;

    const usersResult = await query(
      `select u.email, s.*
       from users u
       join subscriptions s on s.user_id = u.id
       where u.verified_at is not null`
    );

    let sent = 0;
    let skipped = 0;
    const failures = [];
    for (const user of usersResult.rows) {
      if (!isDigestDue(user)) {
        skipped += 1;
        continue;
      }
      const matching = eventsForUser(events, user);
      if (matching.length === 0) {
        skipped += 1;
        continue;
      }

      // Per-user isolation: one failed send must not abort the run (which
      // would re-send to users who already received their digest) and must
      // not mark the failed user as digested.
      try {
        const email = restaurantDigestEmail(matching);
        await sendEmail({
          to: user.email,
          subject: email.subject,
          text: email.text,
          html: email.html
        });
        await query(
          `update subscriptions set last_digest_at = now() where user_id = $1`,
          [user.user_id]
        );
        sent += 1;
      } catch (error) {
        failures.push(user.email);
        console.error("[notifications/digest:user]", {
          email: user.email,
          message: error.message,
          statusCode: error.statusCode
        });
      }
    }

    // The weekly hot pick shares this daily cron (Vercel Hobby allows only
    // two cron jobs) and goes out on Thursdays. Its own error isolation and
    // 5-day guard make this safe to attempt independently of digest results.
    let hotPick = null;
    if (new Date().getUTCDay() === 4) {
      try {
        hotPick = await runHotPickSends();
      } catch (error) {
        hotPick = { error: true };
        console.error("[notifications/digest:hot-pick]", { message: error.message });
      }
    }

    sendJson(res, 200, { sent, skipped, failed: failures.length, events: events.length, hotPick });
  } catch (error) {
    handleError(res, error);
  }
}
