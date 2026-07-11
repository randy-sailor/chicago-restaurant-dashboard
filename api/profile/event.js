import { query } from "../_lib/db.js";
import { requireSession } from "../_lib/session.js";
import { assertMethod, handleError, readJson, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, "POST");
    const session = requireSession(req);
    const body = await readJson(req);
    const action = String(body.action || "");
    const restaurantId = String(body.restaurantId || "");
    if (!["saved", "visited", "passed"].includes(action) || !restaurantId) {
      throw Object.assign(new Error("Invalid profile event."), { statusCode: 400 });
    }

    await query(
      `insert into taste_events (user_id, restaurant_id, action)
       values ($1, $2, $3)`,
      [session.id, restaurantId, action]
    );

    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
