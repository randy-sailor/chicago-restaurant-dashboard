import { query } from "../_lib/db.js";
import { readSession } from "../_lib/session.js";
import { handleError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    const session = readSession(req);
    if (!session) {
      sendJson(res, 200, { user: null });
      return;
    }

    const [subscription, events] = await Promise.all([
      query(`select hot_new, awarded, iconic, essential, frequency from subscriptions where user_id = $1`, [session.id]),
      query(
        `select restaurant_id, action, created_at
         from taste_events
         where user_id = $1
         order by created_at desc
         limit 200`,
        [session.id]
      )
    ]);

    sendJson(res, 200, {
      user: session,
      subscription: subscription.rows[0] || null,
      events: events.rows
    });
  } catch (error) {
    handleError(res, error);
  }
}
