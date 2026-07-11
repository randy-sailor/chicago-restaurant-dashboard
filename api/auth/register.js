import crypto from "node:crypto";
import { query } from "../_lib/db.js";
import { createSessionCookie } from "../_lib/session.js";
import { assertMethod, handleError, readJson, sendJson } from "../_lib/http.js";
import { sendEmail } from "../_lib/email.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  try {
    assertMethod(req, "POST");
    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw Object.assign(new Error("Enter a valid email address."), { statusCode: 400 });
    }

    const id = crypto.randomUUID();
    const result = await query(
      `insert into users (id, email)
       values ($1, $2)
       on conflict (email)
       do update set last_seen_at = now()
       returning id, email`,
      [id, email]
    );
    const user = result.rows[0];

    await query(
      `insert into subscriptions (user_id)
       values ($1)
       on conflict (user_id) do nothing`,
      [user.id]
    );

    await sendEmail({
      to: user.email,
      subject: "Your Chicago Restaurant Dashboard profile is ready",
      text: "Your profile is ready. You can now save restaurants and receive update notifications.",
      html: "<p>Your Chicago Restaurant Dashboard profile is ready.</p><p>You can now save restaurants and receive update notifications.</p>"
    });

    sendJson(res, 200, { user }, { "Set-Cookie": createSessionCookie(user) });
  } catch (error) {
    handleError(res, error);
  }
}
