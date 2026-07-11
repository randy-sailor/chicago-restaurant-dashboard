import { query } from "./_lib/db.js";
import { requireSession } from "./_lib/session.js";
import { handleError, readJson, sendJson } from "./_lib/http.js";

const columns = ["hot_new", "awarded", "iconic", "essential"];

export default async function handler(req, res) {
  try {
    const session = requireSession(req);

    if (req.method === "GET") {
      const result = await query(`select hot_new, awarded, iconic, essential, frequency from subscriptions where user_id = $1`, [session.id]);
      sendJson(res, 200, { subscription: result.rows[0] || null });
      return;
    }

    if (req.method !== "POST") {
      throw Object.assign(new Error("Use GET or POST."), { statusCode: 405 });
    }

    const body = await readJson(req);
    const values = {
      hot_new: Boolean(body.hot_new),
      awarded: Boolean(body.awarded),
      iconic: Boolean(body.iconic),
      essential: Boolean(body.essential),
      frequency: ["daily", "weekly"].includes(body.frequency) ? body.frequency : "daily"
    };

    const result = await query(
      `insert into subscriptions (user_id, hot_new, awarded, iconic, essential, frequency, updated_at)
       values ($1, $2, $3, $4, $5, $6, now())
       on conflict (user_id)
       do update set hot_new = $2, awarded = $3, iconic = $4, essential = $5, frequency = $6, updated_at = now()
       returning hot_new, awarded, iconic, essential, frequency`,
      [session.id, ...columns.map((key) => values[key]), values.frequency]
    );

    sendJson(res, 200, { subscription: result.rows[0] });
  } catch (error) {
    handleError(res, error);
  }
}
