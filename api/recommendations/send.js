import { sendEmail } from "../_lib/email.js";
import { restaurantRecommendationEmail } from "../_lib/emailTemplates.js";
import { handleError, readJson, sendJson } from "../_lib/http.js";
import { query } from "../_lib/db.js";
import { requireSession } from "../_lib/session.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function assertEmail(email, label) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error(`Enter a valid ${label} email address.`), { statusCode: 400 });
  }
}

function cleanRestaurant(input = {}) {
  const restaurant = {
    id: String(input.id || "").trim(),
    name: String(input.name || "").trim(),
    neighborhood: String(input.neighborhood || "Chicago").trim(),
    format: String(input.format || "Restaurant").trim(),
    address: String(input.address || "").trim(),
    note: String(input.note || "").trim(),
    menu: Array.isArray(input.menu) ? input.menu.map((item) => String(item).trim()).filter(Boolean).slice(0, 6) : []
  };
  if (!restaurant.id || !restaurant.name) {
    throw Object.assign(new Error("Restaurant details are required."), { statusCode: 400 });
  }
  return restaurant;
}

function dashboardUrlFor(restaurantId) {
  const base = process.env.SITE_URL || "https://chicago-restaurant-dashboard.vercel.app";
  const url = new URL(base);
  url.searchParams.set("restaurant", restaurantId);
  return url.toString();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      throw Object.assign(new Error("Use POST."), { statusCode: 405 });
    }

    const session = requireSession(req);
    const body = await readJson(req);
    const to = normalizeEmail(body.to);
    assertEmail(to, "recipient");

    const profileResult = await query(
      `select display_name from user_profiles where user_id = $1`,
      [session.id]
    );
    const displayName = String(profileResult.rows[0]?.display_name || "").trim();
    const senderName = displayName || session.email;

    const restaurant = cleanRestaurant(body.restaurant);
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
