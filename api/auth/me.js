import { query } from "../_lib/db.js";
import { readSession } from "../_lib/session.js";
import { assertMethod, handleError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, "GET");
    const session = readSession(req);
    if (!session) {
      sendJson(res, 200, { user: null });
      return;
    }

    const [subscription, signals, profile] = await Promise.all([
      query(`select hot_new, awarded, iconic, essential, frequency from subscriptions where user_id = $1`, [session.id]),
      query(
        `select restaurant_id, action, created_at
         from taste_signals
         where user_id = $1
         order by created_at desc
         limit 500`,
        [session.id]
      ),
      query(
        `select display_name, home_neighborhood, favorite_cuisines, dietary_preferences, dining_occasions, price_preference, bio, updated_at
         from user_profiles
         where user_id = $1`,
        [session.id]
      )
    ]);

    sendJson(res, 200, {
      user: session,
      subscription: subscription.rows[0] || null,
      signals: signals.rows,
      profile: profile.rows[0] || null
    });
  } catch (error) {
    handleError(res, error);
  }
}
