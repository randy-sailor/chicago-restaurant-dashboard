// Pure selection logic for the weekly hot-pick email, kept separate for
// unit testing. The sends table guarantees a subscriber never receives the
// same restaurant twice; this picks uniformly from what remains.
export function pickHotPick(restaurants, sentIds, random = Math.random) {
  const available = restaurants.filter((restaurant) => !sentIds.has(restaurant.id));
  if (!available.length) return null;
  return available[Math.floor(random() * available.length)];
}

export function reservationFor(restaurant, reservationLinks = {}) {
  const link = reservationLinks[restaurant.id];
  if (link) return { label: link.label, url: link.url, note: link.note };
  return {
    label: "Restaurant / source page",
    url: restaurant.url,
    note: "No dedicated reservation link is stored yet; confirm current booking details on the official or source page."
  };
}

export function dashboardUrlFor(restaurantId) {
  const base = process.env.SITE_URL || "https://chicago-restaurant-dashboard.vercel.app";
  const url = new URL(base);
  url.searchParams.set("restaurant", restaurantId);
  return url.toString();
}
