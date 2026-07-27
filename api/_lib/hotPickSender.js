import { query } from "./db.js";
import { sendEmail } from "./email.js";
import { hotPickEmail } from "./emailTemplates.js";
import { dashboardData } from "./restaurants.js";
import { dashboardUrlFor, pickHotPick, reservationFor } from "./hotPick.js";

// Sends one never-repeating random curated restaurant to each opted-in
// verified subscriber. Called by the daily notifications cron on Thursdays
// (Vercel's Hobby plan allows only two cron jobs, so the hot pick shares
// the digest schedule) and by the manual /api/notifications/hot-pick route.
export async function runHotPickSends() {
  const { restaurants, reservationLinks } = dashboardData();
  const usersResult = await query(
    `select u.id as user_id, u.email
     from users u
     join subscriptions s on s.user_id = u.id
     where u.verified_at is not null and s.hot_pick`
  );

  let sent = 0;
  let skipped = 0;
  let exhausted = 0;
  const failures = [];
  for (const user of usersResult.rows) {
    try {
      // Guard against the schedule firing twice in one week.
      const recent = await query(
        `select 1 from hot_pick_sends
         where user_id = $1 and sent_at > now() - interval '5 days'
         limit 1`,
        [user.user_id]
      );
      if (recent.rows.length) {
        skipped += 1;
        continue;
      }

      const sentResult = await query(
        `select restaurant_id from hot_pick_sends where user_id = $1`,
        [user.user_id]
      );
      const sentIds = new Set(sentResult.rows.map((row) => row.restaurant_id));
      const restaurant = pickHotPick(restaurants, sentIds);
      if (!restaurant) {
        // Never-repeating: once a subscriber has received every curated
        // restaurant, stop rather than recycle.
        exhausted += 1;
        continue;
      }

      const reservation = reservationFor(restaurant, reservationLinks);
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address} Chicago`)}`;
      const email = hotPickEmail({
        restaurant,
        reservation,
        mapsUrl,
        dashboardUrl: dashboardUrlFor(restaurant.id)
      });
      await sendEmail({
        to: user.email,
        subject: email.subject,
        text: email.text,
        html: email.html
      });
      await query(
        `insert into hot_pick_sends (user_id, restaurant_id)
         values ($1, $2)
         on conflict (user_id, restaurant_id) do nothing`,
        [user.user_id, restaurant.id]
      );
      sent += 1;
    } catch (error) {
      failures.push(user.email);
      console.error("[notifications/hot-pick:user]", {
        email: user.email,
        message: error.message,
        statusCode: error.statusCode
      });
    }
  }

  return { sent, skipped, exhausted, failed: failures.length, subscribers: usersResult.rows.length };
}
