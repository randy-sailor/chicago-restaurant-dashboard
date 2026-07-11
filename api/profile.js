import { query } from "./_lib/db.js";
import { requireSession } from "./_lib/session.js";
import { handleError, readJson, sendJson } from "./_lib/http.js";

function cleanList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 20);
  }
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function cleanText(value, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export default async function handler(req, res) {
  try {
    const session = requireSession(req);

    if (req.method === "GET") {
      const result = await query(
        `select display_name, home_neighborhood, favorite_cuisines, dietary_preferences, dining_occasions, price_preference, bio, updated_at
         from user_profiles
         where user_id = $1`,
        [session.id]
      );
      sendJson(res, 200, { profile: result.rows[0] || null });
      return;
    }

    if (req.method !== "POST") {
      throw Object.assign(new Error("Use GET or POST."), { statusCode: 405 });
    }

    const body = await readJson(req);
    const pricePreference = ["$", "$$", "$$$", "$$$$"].includes(body.pricePreference)
      ? body.pricePreference
      : "";
    const values = {
      displayName: cleanText(body.displayName, 80),
      homeNeighborhood: cleanText(body.homeNeighborhood, 80),
      favoriteCuisines: cleanList(body.favoriteCuisines),
      dietaryPreferences: cleanList(body.dietaryPreferences),
      diningOccasions: cleanList(body.diningOccasions),
      pricePreference,
      bio: cleanText(body.bio, 500)
    };

    const result = await query(
      `insert into user_profiles (
         user_id, display_name, home_neighborhood, favorite_cuisines,
         dietary_preferences, dining_occasions, price_preference, bio, updated_at
       )
       values ($1, $2, $3, $4, $5, $6, $7, $8, now())
       on conflict (user_id)
       do update set
         display_name = excluded.display_name,
         home_neighborhood = excluded.home_neighborhood,
         favorite_cuisines = excluded.favorite_cuisines,
         dietary_preferences = excluded.dietary_preferences,
         dining_occasions = excluded.dining_occasions,
         price_preference = excluded.price_preference,
         bio = excluded.bio,
         updated_at = now()
       returning display_name, home_neighborhood, favorite_cuisines, dietary_preferences, dining_occasions, price_preference, bio, updated_at`,
      [
        session.id,
        values.displayName || null,
        values.homeNeighborhood || null,
        values.favoriteCuisines,
        values.dietaryPreferences,
        values.diningOccasions,
        values.pricePreference || null,
        values.bio || null
      ]
    );

    sendJson(res, 200, { profile: result.rows[0] });
  } catch (error) {
    handleError(res, error);
  }
}
