import { sendEmail } from "../_lib/email.js";
import { restaurantRecommendationEmail } from "../_lib/emailTemplates.js";
import { handleError, readJson, sendJson } from "../_lib/http.js";

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

    const body = await readJson(req);
    const to = normalizeEmail(body.to);
    const senderEmail = normalizeEmail(body.senderEmail);
    assertEmail(to, "recipient");
    assertEmail(senderEmail, "sender");

    const restaurant = cleanRestaurant(body.restaurant);
    const message = String(body.message || "").trim().slice(0, 500);
    const email = restaurantRecommendationEmail({
      restaurant,
      senderEmail,
      message,
      restaurantUrl: dashboardUrlFor(restaurant.id)
    });

    await sendEmail({
      to,
      subject: email.subject,
      text: email.text,
      html: email.html
    });

    sendJson(res, 200, { sent: true });
  } catch (error) {
    handleError(res, error);
  }
}
