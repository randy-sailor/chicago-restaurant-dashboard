import { query } from "../_lib/db.js";
import { handleError, readJson, sendJson } from "../_lib/http.js";
import { requireCronSecret } from "../_lib/cron.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      throw Object.assign(new Error("Use POST."), { statusCode: 405 });
    }
    requireCronSecret(req);
    const body = await readJson(req);
    const eventType = String(body.eventType || "");
    if (!["announced", "awarded", "captured"].includes(eventType)) {
      throw Object.assign(new Error("Invalid event type."), { statusCode: 400 });
    }
    const restaurantName = String(body.restaurantName || "").trim();
    if (!restaurantName) {
      throw Object.assign(new Error("restaurantName is required."), { statusCode: 400 });
    }

    const result = await query(
      `insert into restaurant_events (restaurant_id, restaurant_name, event_type, source_title, source_url, occurred_at)
       values ($1, $2, $3, $4, $5, coalesce($6::timestamptz, now()))
       returning *`,
      [
        String(body.restaurantId || restaurantName).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        restaurantName,
        eventType,
        body.sourceTitle || null,
        body.sourceUrl || null,
        body.occurredAt || null
      ]
    );

    sendJson(res, 200, { event: result.rows[0] });
  } catch (error) {
    handleError(res, error);
  }
}
