import { query } from "../_lib/db.js";
import { requireSession } from "../_lib/session.js";
import { assertMethod, handleError, readJson, sendJson } from "../_lib/http.js";

// A restaurant cannot be passed and saved/visited at the same time.
const CLEARS = {
  saved: ["passed"],
  visited: ["passed"],
  passed: ["saved", "visited"]
};

export default async function handler(req, res) {
  try {
    assertMethod(req, "POST");
    const session = requireSession(req);
    const body = await readJson(req);
    const action = String(body.action || "");
    const restaurantId = String(body.restaurantId || "");
    const active = body.active !== false;
    if (!["saved", "visited", "passed"].includes(action) || !restaurantId) {
      throw Object.assign(new Error("Invalid profile event."), { statusCode: 400 });
    }

    if (active) {
      await query(
        `insert into taste_signals (user_id, restaurant_id, action)
         values ($1, $2, $3)
         on conflict (user_id, restaurant_id, action)
         do update set updated_at = now()`,
        [session.id, restaurantId, action]
      );
      await query(
        `delete from taste_signals
         where user_id = $1 and restaurant_id = $2 and action = any($3::text[])`,
        [session.id, restaurantId, CLEARS[action]]
      );
      await query(
        `insert into taste_events (user_id, restaurant_id, action)
         values ($1, $2, $3)`,
        [session.id, restaurantId, action]
      );
    } else {
      await query(
        `delete from taste_signals
         where user_id = $1 and restaurant_id = $2 and action = $3`,
        [session.id, restaurantId, action]
      );
    }

    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
