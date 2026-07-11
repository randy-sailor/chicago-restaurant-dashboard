import { sendEmail } from "../_lib/email.js";
import { restaurantRecommendationEmail } from "../_lib/emailTemplates.js";
import { assertMethod, handleError, readJson, sendJson } from "../_lib/http.js";
import { query } from "../_lib/db.js";
import { requireSession } from "../_lib/session.js";
import { findRestaurant } from "../_lib/restaurants.js";

const MAX_SENDS_PER_HOUR = 10;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertEmail(email, label) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error(`Enter a valid ${label} email address.`), { statusCode: 400 });
  }
}

function dashboardUrlFor(restaurantId) {
  const base = process.env.SITE_URL || "https://chicago-restaurant-dashboard.vercel.app";
  const url = new URL(base);
  url.searchParams.set("restaurant", restaurantId);
  return url.toString();
}

export default async function handler(req, res) {
  try {
    assertMethod(req, "POST");
    const session = requireSession(req);
    const body = await readJson(req);
    const to = normalizeEmail(body.to);
    assertEmail(to, "recipient");

    // Only curated restaurants can be recommended, and all email content
    // except the personal note comes from the server-side dataset so the
    // endpoint cannot be used to send arbitrary content.
    const restaurantId = String(body.restaurantId || body.restaurant?.id || "").trim();
    const record = findRestaurant(restaurantId);
    if (!record) {
      throw Object.assign(new Error("Unknown restaurant."), { statusCode: 400 });
    }
    const restaurant = {
      id: record.id,
      name: record.name,
      neighborhood: record.neighborhood,
      format: record.format,
      address: record.address,
      note: record.note,
      menu: Array.isArray(record.menu) ? record.menu.slice(0, 6) : []
    };

    const recentSends = await query(
      `select count(*)::int as count
       from recommendation_events
       where sender_user_id = $1 and created_at > now() - interval '1 hour'`,
      [session.id]
    );
    if (recentSends.rows[0].count >= MAX_SENDS_PER_HOUR) {
      throw Object.assign(
        new Error("Recommendation limit reached. Try again in an hour."),
        { statusCode: 429 }
      );
    }

    const profileResult = await query(
      `select display_name from user_profiles where user_id = $1`,
      [session.id]
    );
    const displayName = String(profileResult.rows[0]?.display_name || "").trim();
    const senderName = displayName || session.email;

    const message = String(body.message || "").trim().slice(0, 500);
    const email = restaurantRecommendationEmail({
      restaurant,
      senderEmail: senderName,
      message,
      restaurantUrl: dashboardUrlFor(restaurant.id)
    });

    await sendEmail({
      to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      replyTo: session.email
    });

    await query(
      `insert into recommendation_events (
         sender_user_id, sender_email, sender_display_name, recipient_email,
         restaurant_id, restaurant_name, message
       )
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [session.id, session.email, displayName || null, to, restaurant.id, restaurant.name, message || null]
    );

    sendJson(res, 200, { sent: true });
  } catch (error) {
    handleError(res, error);
  }
}
