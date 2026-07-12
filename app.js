// Chicago Restaurant Dashboard frontend. The curated dataset is loaded by
// data/restaurants.js (window.DASHBOARD_DATA), which is also read server-side
// by api/_lib/restaurants.js — lanes arrive already normalized.
const DATA = window.DASHBOARD_DATA || { sources: [], laneDefs: [], restaurants: [], reservationLinks: {} };
const SOURCES = DATA.sources;
const RESTAURANTS = DATA.restaurants;
const LANE_DEFS = DATA.laneDefs;
const RESERVATION_LINKS = DATA.reservationLinks;

const state = {
  view: "discover",
  search: "",
  lane: "all",
  occasions: new Set(),
  cuisines: new Set(),
  neighborhood: "All",
  novelty: 0,
  sort: "match",
  mapZoom: 10,
  account: null,
  pendingEmail: null,
  userProfile: null,
  ingestionStatus: null,
  profile: loadProfile()
};

const $ = (selector) => document.querySelector(selector);

function switchView(viewName) {
  state.view = viewName;
  document.querySelectorAll(".tab").forEach((button) => {
    const active = button.dataset.viewButton === viewName;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "true");
    else button.removeAttribute("aria-current");
  });
  const accountButton = $("#accountButton");
  accountButton.classList.toggle("active", viewName === "account");
  if (viewName === "account") accountButton.setAttribute("aria-current", "true");
  else accountButton.removeAttribute("aria-current");
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `${viewName}View`);
  });
}

function normalizeUserProfile(profile = {}) {
  return {
    displayName: profile.display_name || profile.displayName || "",
    homeNeighborhood: profile.home_neighborhood || profile.homeNeighborhood || "",
    favoriteCuisines: profile.favorite_cuisines || profile.favoriteCuisines || [],
    dietaryPreferences: profile.dietary_preferences || profile.dietaryPreferences || [],
    diningOccasions: profile.dining_occasions || profile.diningOccasions || [],
    pricePreference: profile.price_preference || profile.pricePreference || "",
    bio: profile.bio || ""
  };
}

function listToText(value) {
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function profileSenderName() {
  return state.userProfile?.displayName || state.account?.email || "";
}


function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function loadProfile() {
  const base = { saved: [], visited: [], passed: [], events: [] };
  try {
    return { ...base, ...JSON.parse(localStorage.getItem("chiRestaurantProfile") || "{}") };
  } catch {
    return base;
  }
}

function saveProfile() {
  localStorage.setItem("chiRestaurantProfile", JSON.stringify(state.profile));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function applyRemoteSignals(signals = []) {
  const next = { saved: [], visited: [], passed: [], events: state.profile.events || [] };
  signals.forEach((signal) => {
    if (next[signal.action] && !next[signal.action].includes(signal.restaurant_id)) {
      next[signal.action].push(signal.restaurant_id);
    }
  });
  state.profile = next;
  saveProfile();
}

// Push signals recorded while signed out up to the server, once, at the
// moment of an explicit sign-in. On regular loads the server state wins.
async function pushLocalSignals() {
  const pushes = [];
  ["saved", "visited", "passed"].forEach((action) => {
    (state.profile[action] || []).forEach((id) => {
      pushes.push(api("/api/profile/event", {
        method: "POST",
        body: JSON.stringify({ action, restaurantId: id, active: true })
      }).catch(() => null));
    });
  });
  await Promise.all(pushes);
}

function renderAccount() {
  const status = $("#accountStatus");
  const form = $("#accountForm");
  const verifyForm = $("#verifyForm");
  const logout = $("#logoutButton");
  if (state.account) {
    const name = profileSenderName();
    status.textContent = `Signed in as ${name}${name !== state.account.email ? ` (${state.account.email})` : ""}`;
    form.hidden = true;
    verifyForm.hidden = true;
    logout.hidden = false;
  } else if (state.pendingEmail) {
    status.textContent = `We emailed a 6-digit code to ${state.pendingEmail}. Enter it to finish signing in.`;
    form.hidden = true;
    verifyForm.hidden = false;
    logout.hidden = true;
  } else {
    status.textContent = "Sign in or create a profile to sync taste signals and receive updates.";
    form.hidden = false;
    verifyForm.hidden = true;
    logout.hidden = true;
  }
  // Notification preferences only apply to signed-in accounts; disable
  // the form instead of rejecting at submit time.
  $("#notificationForm").querySelectorAll("input, select, button").forEach((element) => {
    element.disabled = !state.account;
  });

  const accountButton = $("#accountButton");
  accountButton.classList.toggle("signed-in", Boolean(state.account));
  const label = state.account
    ? `Account settings, signed in as ${state.account.email}`
    : "Account settings, signed out";
  accountButton.setAttribute("aria-label", label);
  accountButton.title = label;
}

function renderPreferenceForm() {
  const form = $("#preferenceForm");
  if (!form) return;
  const profile = normalizeUserProfile(state.userProfile || {});
  form.elements.displayName.value = profile.displayName;
  form.elements.homeNeighborhood.value = profile.homeNeighborhood;
  form.elements.favoriteCuisines.value = listToText(profile.favoriteCuisines);
  form.elements.dietaryPreferences.value = listToText(profile.dietaryPreferences);
  form.elements.diningOccasions.value = listToText(profile.diningOccasions);
  form.elements.pricePreference.value = profile.pricePreference;
  form.elements.bio.value = profile.bio;
  form.querySelector("button").disabled = !state.account;
  $("#preferenceStatus").textContent = state.account
    ? "These fields personalize sharing, recommendations, and future profile features."
    : "Create an account first, then save your eating profile.";
}

function applySubscription(subscription) {
  if (!subscription) return;
  const form = $("#notificationForm");
  ["hot_new", "awarded", "essential", "iconic"].forEach((name) => {
    form.elements[name].checked = Boolean(subscription[name]);
  });
  form.elements.frequency.value = subscription.frequency || "daily";
}

async function loadAccount() {
  try {
    const data = await api("/api/auth/me");
    state.account = data.user;
    state.userProfile = data.profile ? normalizeUserProfile(data.profile) : null;
    if (data.user) applyRemoteSignals(data.signals || []);
    applySubscription(data.subscription);
  } catch {
    state.account = null;
    state.userProfile = null;
  }
  renderAccount();
  renderPreferenceForm();
  render();
}

function uniq(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function setupFilters() {
  const occasions = uniq(RESTAURANTS.flatMap((r) => r.occasions));
  const cuisines = uniq(RESTAURANTS.flatMap((r) => r.cuisine));
  const neighborhoods = ["All", ...uniq(RESTAURANTS.map((r) => r.neighborhood))];
  $("#laneFilters").innerHTML = LANE_DEFS.map((lane) => `<button class="lane-chip ${lane.id === state.lane ? "active" : ""}" data-lane="${lane.id}" aria-pressed="${lane.id === state.lane}"><strong>${lane.label}</strong><span>${lane.note}</span></button>`).join("");
  $("#occasionFilters").innerHTML = occasions.map((value) => `<button class="chip" data-filter="occasion" data-value="${value}" aria-pressed="false">${value}</button>`).join("");
  $("#cuisineFilters").innerHTML = cuisines.map((value) => `<button class="chip" data-filter="cuisine" data-value="${value}" aria-pressed="false">${value}</button>`).join("");
  $("#neighborhoodSelect").innerHTML = neighborhoods.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function tasteWeights() {
  const weights = {};
  const apply = (id, delta) => {
    const restaurant = RESTAURANTS.find((r) => r.id === id);
    if (!restaurant) return;
    [...restaurant.cuisine, ...restaurant.occasions].forEach((signal) => {
      weights[signal] = (weights[signal] || 0) + delta;
    });
  };
  state.profile.saved.forEach((id) => apply(id, 3));
  state.profile.visited.forEach((id) => apply(id, 5));
  state.profile.passed.forEach((id) => apply(id, -2));
  return weights;
}

function scoreRestaurant(restaurant) {
  const weights = tasteWeights();
  const tasteScore = [...restaurant.cuisine, ...restaurant.occasions].reduce((sum, signal) => sum + (weights[signal] || 0), 0);
  const pricePenalty = restaurant.price > 3 ? 2 : 0;
  const passedPenalty = state.profile.passed.includes(restaurant.id) ? 18 : 0;
  const visitedBoost = state.profile.visited.includes(restaurant.id) ? -6 : 0;
  const base = (restaurant.heat * 0.38) + (restaurant.novelty * 0.34) + ((5 - restaurant.price) * 4) + tasteScore + visitedBoost - pricePenalty - passedPenalty;
  return Math.max(1, Math.min(99, Math.round(base)));
}

function filteredRestaurants() {
  const q = state.search.trim().toLowerCase();
  let rows = RESTAURANTS.filter((restaurant) => {
    const haystack = [restaurant.name, restaurant.neighborhood, restaurant.address, restaurant.format, restaurant.note, ...restaurant.cuisine, ...restaurant.occasions, ...restaurant.menu].join(" ").toLowerCase();
    const searchMatch = !q || haystack.includes(q);
    const occasionMatch = state.occasions.size === 0 || restaurant.occasions.some((value) => state.occasions.has(value));
    const cuisineMatch = state.cuisines.size === 0 || restaurant.cuisine.some((value) => state.cuisines.has(value));
    const neighborhoodMatch = state.neighborhood === "All" || restaurant.neighborhood === state.neighborhood;
    const noveltyMatch = restaurant.novelty >= state.novelty;
    const laneMatch = state.lane === "all" || restaurant.lanes.includes(state.lane);
    return searchMatch && laneMatch && occasionMatch && cuisineMatch && neighborhoodMatch && noveltyMatch;
  });

  rows = rows.map((restaurant) => ({ ...restaurant, score: scoreRestaurant(restaurant) }));

  rows.sort((a, b) => {
    if (state.lane === "personal") return b.score - a.score;
    if (state.sort === "new") return b.opened.localeCompare(a.opened);
    if (state.sort === "heat") return b.heat - a.heat;
    if (state.sort === "price") return a.price - b.price || b.score - a.score;
    return b.score - a.score;
  });
  return rows;
}

function priceLabel(value) {
  return "$".repeat(value);
}

function sourceText(restaurant) {
  return restaurant.sourceIds.map((id) => SOURCES.find((s) => s.id === id)?.title).filter(Boolean).join(", ");
}

function sourceRecords(restaurant) {
  return restaurant.sourceIds.map((id) => SOURCES.find((s) => s.id === id)).filter(Boolean);
}

function reservationInfo(restaurant) {
  return RESERVATION_LINKS[restaurant.id] || {
    label: "Official / source link",
    url: restaurant.url,
    note: "No dedicated reservation link is stored yet; use the official or source link to confirm current booking details."
  };
}

function laneLabel(id) {
  return LANE_DEFS.find((lane) => lane.id === id)?.label || id;
}

function renderMetrics(rows) {
  const avgHeat = rows.length ? Math.round(rows.reduce((sum, r) => sum + r.heat, 0) / rows.length) : 0;
  const neighborhoods = uniq(rows.map((r) => r.neighborhood)).length;
  const experiences = rows.filter((r) => r.occasions.includes("Experience")).length;
  $("#metricGrid").innerHTML = [
    ["matches", "Matches", rows.length, "Filtered places"],
    ["heat", "Avg heat", avgHeat, "Popularity + novelty"],
    ["areas", "Areas", neighborhoods, "Neighborhoods"],
    ["experiences", "Experiences", experiences, "Experience-led places"]
  ].map(([action, label, value, note]) => `
    <button class="metric" type="button" data-metric-action="${action}" aria-label="${label}: ${value}. ${note}">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      <div class="hint">${note}</div>
    </button>
  `).join("");
}

let detailReturnFocus = null;

function openDetail(html) {
  const overlay = $("#detailOverlay");
  const panel = $("#detailPanel");
  if (!overlay.classList.contains("active")) {
    detailReturnFocus = document.activeElement;
  }
  panel.innerHTML = html;
  overlay.classList.add("active");
  overlay.setAttribute("aria-hidden", "false");
  panel.querySelector("[data-detail-close]")?.focus();
}

function closeDetail() {
  $("#detailOverlay").classList.remove("active");
  $("#detailOverlay").setAttribute("aria-hidden", "true");
  $("#detailPanel").innerHTML = "";
  if (detailReturnFocus?.isConnected) detailReturnFocus.focus();
  detailReturnFocus = null;
}

function openRestaurantDetail(id) {
  const base = RESTAURANTS.find((restaurant) => restaurant.id === id);
  if (!base) return;
  const restaurant = { ...base, score: scoreRestaurant(base) };
  const sources = sourceRecords(restaurant);
  const booking = reservationInfo(restaurant);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${restaurant.name} ${restaurant.address} Chicago`)}`;
  openDetail(`
    <div class="detail-hero" style="--tone:${esc(restaurant.tone)}">
      <div class="detail-top">
        <div>
          <span class="badge">${esc(restaurant.neighborhood)}</span>
          <h2 id="detailTitle">${esc(restaurant.name)}</h2>
          <div>${esc(restaurant.format)}</div>
        </div>
        <button class="detail-close" type="button" data-detail-close aria-label="Close details">×</button>
      </div>
    </div>
    <div class="detail-body">
      <div class="detail-grid">
        <div class="detail-stat"><span class="hint">Match</span><strong>${restaurant.score}</strong></div>
        <div class="detail-stat"><span class="hint">Heat</span><strong>${restaurant.heat}</strong></div>
        <div class="detail-stat"><span class="hint">Price</span><strong>${esc(priceLabel(restaurant.price))}</strong></div>
      </div>

      <section class="detail-section">
        <h3>Why It Matches</h3>
        <p class="hint">${esc(restaurant.note)}</p>
        <div class="tags">${[...restaurant.cuisine, ...restaurant.occasions].map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
        <div class="tags">${restaurant.lanes.filter((lane) => lane !== "personal").map((lane) => `<span class="tag">${esc(laneLabel(lane))}</span>`).join("")}</div>
      </section>

      <section class="detail-section">
        <h3>Menu And Experience Signals</h3>
        <ul class="menu-list">${restaurant.menu.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
      </section>

      <section class="detail-section">
        <h3>Reservations And Links</h3>
        <div class="detail-links">
          <a class="detail-link primary" href="${esc(booking.url)}" target="_blank" rel="noreferrer">${esc(booking.label)}</a>
          <a class="detail-link" href="${esc(restaurant.url)}" target="_blank" rel="noreferrer">Restaurant / source page</a>
          <a class="detail-link" href="${esc(mapsUrl)}" target="_blank" rel="noreferrer">Open map</a>
          <button class="detail-link" type="button" data-recommend-restaurant="${esc(restaurant.id)}">Recommend</button>
        </div>
        <p class="hint" style="margin:10px 0 0;">${esc(booking.note)}</p>
      </section>

      <section class="detail-section">
        <h3>Source Information</h3>
        <div class="detail-source-list">
          ${sources.map((source) => `
            <div>
              <a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.title)}</a>
              <div class="hint">${esc(source.freshness)} · ${esc(source.contributes)}</div>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
  `);
}

function restaurantSharePayload(restaurant) {
  return {
    id: restaurant.id,
    name: restaurant.name,
    neighborhood: restaurant.neighborhood,
    format: restaurant.format,
    address: restaurant.address,
    note: restaurant.note,
    menu: restaurant.menu
  };
}

function openRecommendDialog(id) {
  const restaurant = RESTAURANTS.find((item) => item.id === id);
  if (!restaurant) return;
  const sender = profileSenderName();
  openDetail(`
    <div class="detail-hero" style="--tone:${esc(restaurant.tone)}">
      <div class="detail-top">
        <div>
          <span class="badge">Send recommendation</span>
          <h2 id="detailTitle">${esc(restaurant.name)}</h2>
          <div>${esc(restaurant.neighborhood)} · ${esc(restaurant.format)}</div>
        </div>
        <button class="detail-close" type="button" data-detail-close aria-label="Close details">×</button>
      </div>
    </div>
    <div class="detail-body">
      <section class="detail-section">
        <h3>Tell someone they might want to try it</h3>
        <p class="hint">${state.account ? `This sends as ${esc(sender)} through Chicago Restaurant Dashboard, with replies routed to ${esc(state.account.email)}.` : "Create an account first so recommendations can include your profile name and reply-to email."}</p>
        <form class="recommend-form" id="recommendForm" data-recommend-id="${esc(restaurant.id)}">
          <label>
            Recipient email
            <input name="to" type="email" required placeholder="friend@example.com" ${state.account ? "" : "disabled"}>
          </label>
          <label>
            Optional note
            <textarea name="message" maxlength="500" placeholder="I thought this looked like your kind of place." ${state.account ? "" : "disabled"}></textarea>
          </label>
          <button type="submit" ${state.account ? "" : "disabled"}>Send recommendation</button>
        </form>
        <p class="hint" id="recommendStatus" role="status"></p>
      </section>
    </div>
  `);
}

async function sendRecommendation(form) {
  const id = form.dataset.recommendId;
  const restaurant = RESTAURANTS.find((item) => item.id === id);
  if (!restaurant) return;
  const status = $("#recommendStatus");
  const button = form.querySelector("button");
  if (!state.account) {
    status.textContent = "Create an account first.";
    return;
  }
  status.textContent = "Sending recommendation...";
  button.disabled = true;
  try {
    await api("/api/recommendations/send", {
      method: "POST",
      body: JSON.stringify({
        to: form.elements.to.value,
        message: form.elements.message.value,
        restaurant: restaurantSharePayload(restaurant)
      })
    });
    status.textContent = "Recommendation sent.";
    form.reset();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

function openAreaBreakdown(rows) {
  const grouped = uniq(rows.map((r) => r.neighborhood)).map((area) => {
    const areaRows = rows.filter((r) => r.neighborhood === area);
    const avg = Math.round(areaRows.reduce((sum, r) => sum + r.heat, 0) / areaRows.length);
    return { area, count: areaRows.length, avg, top: areaRows.sort((a, b) => b.score - a.score)[0] };
  }).sort((a, b) => b.count - a.count || b.avg - a.avg);

  openDetail(`
    <div class="detail-hero" style="--tone:var(--blue)">
      <div class="detail-top">
        <div>
          <span class="badge">Areas</span>
          <h2 id="detailTitle">Neighborhood Breakdown</h2>
          <div>${rows.length} filtered restaurants across ${grouped.length} areas.</div>
        </div>
        <button class="detail-close" type="button" data-detail-close aria-label="Close details">×</button>
      </div>
    </div>
    <div class="detail-body">
      ${grouped.map((group) => `
        <button class="detail-section" type="button" data-area-filter="${esc(group.area)}">
          <h3>${esc(group.area)}</h3>
          <p class="hint">${group.count} matches · avg heat ${group.avg} · top match: ${esc(group.top.name)}</p>
        </button>
      `).join("")}
    </div>
  `);
}

function handleMetricAction(action) {
  if (action === "matches") {
    state.search = "";
    state.occasions.clear();
    state.cuisines.clear();
    state.neighborhood = "All";
    state.novelty = 0;
    $("#searchInput").value = "";
    $("#neighborhoodSelect").value = "All";
    $("#noveltyRange").value = "0";
    $("#noveltyValue").textContent = "0";
    document.querySelectorAll(".chip.active").forEach((chip) => chip.classList.remove("active"));
    render();
    $("#restaurantCards").scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (action === "heat") {
    state.sort = "heat";
    $("#sortSelect").value = "heat";
    render();
  } else if (action === "areas") {
    openAreaBreakdown(filteredRestaurants());
  } else if (action === "experiences") {
    state.occasions = new Set(["Experience"]);
    document.querySelectorAll("[data-filter='occasion']").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.value === "Experience");
    });
    render();
    $("#restaurantCards").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const mapTileState = { zoom: null, width: 0, height: 0 };

function mapViewport(map) {
  const rect = map.getBoundingClientRect();
  const width = Math.max(320, rect.width || map.clientWidth || 540);
  const height = Math.max(360, rect.height || map.clientHeight || 430);
  const zoom = state.mapZoom;
  const tileSize = 256;
  const scale = tileSize * Math.pow(2, zoom);
  const worldFromLatLng = (lat, lng) => {
    const sin = Math.sin((lat * Math.PI) / 180);
    return {
      x: ((lng + 180) / 360) * scale,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
    };
  };
  const centerWorld = worldFromLatLng(41.885, -87.635);
  const topLeft = { x: centerWorld.x - width / 2, y: centerWorld.y - height / 2 };
  return { width, height, zoom, tileSize, worldFromLatLng, topLeft };
}

function renderMapTiles(map, tileLayer, viewport) {
  const { width, height, zoom, tileSize, topLeft } = viewport;
  tileLayer.innerHTML = "";
  const minTileX = Math.floor(topLeft.x / tileSize);
  const maxTileX = Math.floor((topLeft.x + width) / tileSize);
  const minTileY = Math.floor(topLeft.y / tileSize);
  const maxTileY = Math.floor((topLeft.y + height) / tileSize);
  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      const img = document.createElement("img");
      img.className = "map-tile";
      img.alt = "";
      img.decoding = "async";
      img.loading = "lazy";
      img.src = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
      img.style.left = `${Math.round(x * tileSize - topLeft.x)}px`;
      img.style.top = `${Math.round(y * tileSize - topLeft.y)}px`;
      tileLayer.appendChild(img);
    }
  }
  mapTileState.zoom = zoom;
  mapTileState.width = width;
  mapTileState.height = height;
}

function renderMap(rows) {
  const map = $("#mapPanel");
  let tileLayer = map.querySelector(".map-tiles");
  if (!tileLayer) {
    tileLayer = document.createElement("div");
    tileLayer.className = "map-tiles";
    map.prepend(tileLayer);
    const controls = document.createElement("div");
    controls.className = "map-controls";
    controls.innerHTML = `<button type="button" data-map-zoom="in" aria-label="Zoom map in">+</button><button type="button" data-map-zoom="out" aria-label="Zoom map out">-</button>`;
    map.appendChild(controls);
    const note = document.createElement("div");
    note.className = "map-offline-note";
    note.innerHTML = `Map tiles © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors. Pins are local source-backed records.`;
    map.appendChild(note);
  }
  map.querySelectorAll(".pin").forEach((pin) => pin.remove());

  const viewport = mapViewport(map);
  // Rebuild the tile layer only when zoom or panel size changes; filter
  // and search re-renders reuse it and just repaint the pins.
  const tilesStale = mapTileState.zoom !== viewport.zoom
    || mapTileState.width !== viewport.width
    || mapTileState.height !== viewport.height;
  if (tilesStale) renderMapTiles(map, tileLayer, viewport);

  const { width, height, worldFromLatLng, topLeft } = viewport;
  rows.forEach((restaurant) => {
    const point = worldFromLatLng(restaurant.lat, restaurant.lng);
    const x = point.x - topLeft.x;
    const y = point.y - topLeft.y;
    if (x < -20 || x > width + 20 || y < -20 || y > height + 20) return;
    const fit = restaurant.score >= 88 ? "strong" : restaurant.score >= 76 ? "good" : "watch";
    const button = document.createElement("button");
    button.className = "pin";
    button.type = "button";
    button.dataset.fit = fit;
    button.style.left = `${Math.round(x)}px`;
    button.style.top = `${Math.round(y)}px`;
    // The tooltip span is display:none until hover/focus, so it does not
    // contribute an accessible name; label the pin explicitly.
    button.setAttribute("aria-label", `Open details for ${restaurant.name} in ${restaurant.neighborhood}`);
    button.innerHTML = `<span aria-hidden="true">${esc(restaurant.name)} - ${esc(restaurant.neighborhood)}</span>`;
    button.addEventListener("click", () => {
      openRestaurantDetail(restaurant.id);
    });
    map.appendChild(button);
  });
}

function renderCards(rows) {
  const laneName = laneLabel(state.lane);
  $("#resultSummary").textContent = `${rows.length} places in ${laneName}, ranked by popularity/award heat, menu interest, novelty, and your saved reactions.`;
  $("#emptyState").classList.toggle("active", rows.length === 0);
  $("#restaurantCards").innerHTML = rows.map((restaurant) => {
    const saved = state.profile.saved.includes(restaurant.id);
    const visited = state.profile.visited.includes(restaurant.id);
    const passed = state.profile.passed.includes(restaurant.id);
    return `
      <article class="restaurant-card" id="card-${restaurant.id}" style="--tone:${restaurant.tone}" data-restaurant-open="${restaurant.id}">
        <div class="card-art">
          <span class="badge">${esc(restaurant.neighborhood)}</span>
        </div>
        <div class="restaurant-body">
          <div class="restaurant-title">
            <div>
              <h3><button class="title-button" type="button" data-restaurant-open="${restaurant.id}" aria-label="Open details for ${esc(restaurant.name)}">${esc(restaurant.name)}</button></h3>
              <div class="meta-line">${esc(restaurant.format)}</div>
              <div class="meta-line">${esc(priceLabel(restaurant.price))} · ${esc(restaurant.address)}</div>
            </div>
            <div class="score" title="Recommendation score">${restaurant.score}</div>
          </div>
          <div class="tags">${restaurant.lanes.filter((lane) => lane !== "personal").map((lane) => `<span class="tag">${esc(laneLabel(lane))}</span>`).join("")}</div>
          <div class="tags">${[...restaurant.cuisine, ...restaurant.occasions.slice(0, 2)].map((tag) => `<span class="tag">${esc(tag)}</span>`).join("")}</div>
          <p class="hint">${esc(restaurant.note)}</p>
          <ul class="menu-list">${restaurant.menu.slice(0, 4).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
          <p class="hint" style="margin:12px 0 0;">Source: ${esc(sourceText(restaurant))}</p>
        </div>
        <div class="restaurant-actions">
          <button data-restaurant-open="${restaurant.id}">Details</button>
          <button class="${saved ? "active" : ""}" data-action="saved" data-id="${restaurant.id}">${saved ? "Saved" : "Save"}</button>
          <button type="button" data-card-menu="${restaurant.id}" aria-expanded="false">More</button>
          <div class="action-menu" id="menu-${restaurant.id}">
            <button type="button" data-recommend-restaurant="${restaurant.id}">Recommend</button>
            <button type="button" class="${visited ? "active" : ""}" data-action="visited" data-id="${restaurant.id}">${visited ? "Visited" : "Mark visited"}</button>
            <button type="button" class="${passed ? "active" : ""}" data-action="passed" data-id="${restaurant.id}">${passed ? "Passed" : "Pass on this"}</button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function renderProfile() {
  const weights = tasteWeights();
  const sortedWeights = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...sortedWeights.map(([, value]) => Math.abs(value)));
  const topWeights = sortedWeights.slice(0, 10);
  const eventCount = state.profile.events.length;
  const saved = state.profile.saved.length;
  const visited = state.profile.visited.length;
  const passed = state.profile.passed.length;

  $("#profileMetrics").innerHTML = [
    ["Saved", saved, "Places you want to try"],
    ["Visited", visited, "Taste confirmations"],
    ["Passed", passed, "Negative signals"],
    ["Events", eventCount, "Local learning actions"]
  ].map(([label, value, note]) => `
    <div class="metric">
      <div class="metric-label">${label}</div>
      <div class="metric-value">${value}</div>
      <div class="hint">${note}</div>
    </div>
  `).join("");

  const weightMarkup = topWeights.length
    ? topWeights.map(([label, value]) => `
      <div class="taste-row">
        <strong>${label}</strong>
        <div class="bar"><div class="bar-fill" style="width:${Math.max(7, Math.abs(value) / max * 100)}%; background:${value >= 0 ? "var(--green)" : "var(--tomato)"}"></div></div>
        <span>${value}</span>
      </div>
    `).join("")
    : `<p class="hint">No taste signals yet. Save or visit a few places and this will wake up.</p>`;
  $("#tasteWeights").innerHTML = weightMarkup;

}

function renderNextUp(rows) {
  const nextRows = rows.slice(0, 4);
  $("#nextUp").innerHTML = nextRows.length
    ? nextRows.map((restaurant) => `
      <button class="chip" type="button" data-restaurant-open="${restaurant.id}" aria-label="Open details for ${esc(restaurant.name)}">
        <strong>${esc(restaurant.name)}</strong>&nbsp;<span>${esc(restaurant.neighborhood)}</span>
      </button>
    `).join("")
    : `<span class="hint">No matches under the current filters.</span>`;
}

function renderSources() {
  $("#sourceCards").innerHTML = SOURCES.map((source) => `
    <article class="source-card">
      <h3>${source.title}</h3>
      <p>${source.contributes}</p>
      <p class="hint">${source.freshness}</p>
      ${source.url === "#" ? `<span class="hint">Official links are attached per restaurant.</span>` : `<a href="${source.url}" target="_blank" rel="noreferrer">Open source</a>`}
    </article>
  `).join("");
  if (!state.ingestionStatus) return;
  const latest = state.ingestionStatus.runs?.[0];
  $("#ingestionSummary").textContent = latest
    ? `Latest run ${latest.status}: ${latest.items_captured} new source items and ${latest.restaurants_captured} restaurant candidates captured.`
    : "No ingestion runs have completed yet.";
  $("#ingestionRuns").innerHTML = (state.ingestionStatus.runs || []).map((run) => `
    <div class="timeline-item"><strong>${esc(run.status)}</strong><br>${new Date(run.started_at).toLocaleString()} · ${run.sources_checked} sources · ${run.error ? esc(run.error) : "No reported errors"}</div>
  `).join("");
  $("#ingestionItems").innerHTML = (state.ingestionStatus.items || []).slice(0, 5).map((item) => `
    <div class="timeline-item"><strong>${esc(item.source_title)}</strong><br><a href="${esc(item.item_url)}" target="_blank" rel="noreferrer">${esc(item.item_title)}</a></div>
  `).join("");
}

async function loadIngestionStatus() {
  try {
    state.ingestionStatus = await api("/api/ingestion/status");
    renderSources();
  } catch (error) {
    $("#ingestionSummary").textContent = "Ingestion status is not available yet.";
  }
}

function toggleArrayValue(key, id) {
  const list = state.profile[key];
  const index = list.indexOf(id);
  const active = index < 0;
  if (active) list.push(id);
  else list.splice(index, 1);
  if (active) {
    // Mirror the server rule: passed excludes saved/visited and vice versa.
    const clears = key === "passed" ? ["saved", "visited"] : ["passed"];
    clears.forEach((other) => {
      const otherIndex = state.profile[other].indexOf(id);
      if (otherIndex >= 0) state.profile[other].splice(otherIndex, 1);
    });
  }
  state.profile.events.unshift({ key, id, at: new Date().toISOString() });
  state.profile.events = state.profile.events.slice(0, 80);
  saveProfile();
  if (state.account) {
    api("/api/profile/event", {
      method: "POST",
      body: JSON.stringify({ action: key, restaurantId: id, active })
    }).catch((error) => {
      console.warn("Profile sync failed", error);
    });
  }
  render();
}

function render() {
  const rows = filteredRestaurants();
  const sortSelect = $("#sortSelect");
  sortSelect.disabled = state.lane === "personal";
  sortSelect.title = sortSelect.disabled
    ? "The Personal Fit lane is always ordered by your match score."
    : "";
  renderMetrics(rows);
  renderNextUp(rows);
  renderMap(rows);
  renderCards(rows);
  renderProfile();
  renderSources();
}

function bindEvents() {
  $("#accountForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = $("#emailInput").value;
    $("#accountStatus").textContent = "Sending sign-in code...";
    try {
      const data = await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      state.pendingEmail = data.email;
      renderAccount();
      $("#codeInput").focus();
    } catch (error) {
      $("#accountStatus").textContent = error.message;
    }
  });

  $("#verifyForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = $("#codeInput").value;
    $("#accountStatus").textContent = "Verifying code...";
    try {
      await api("/api/auth/verify", {
        method: "POST",
        body: JSON.stringify({ email: state.pendingEmail, code })
      });
      state.pendingEmail = null;
      $("#emailInput").value = "";
      $("#codeInput").value = "";
      $("#notificationStatus").textContent = "Signed in. Notification defaults are on.";
      await pushLocalSignals();
      await loadAccount();
    } catch (error) {
      $("#accountStatus").textContent = error.message;
    }
  });

  $("#verifyCancel").addEventListener("click", () => {
    state.pendingEmail = null;
    $("#codeInput").value = "";
    renderAccount();
    $("#emailInput").focus();
  });

  $("#logoutButton").addEventListener("click", async () => {
    await api("/api/auth/logout", { method: "POST", body: "{}" }).catch(() => null);
    state.account = null;
    state.userProfile = null;
    renderAccount();
    renderPreferenceForm();
  });

  $("#preferenceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!state.account) {
      $("#preferenceStatus").textContent = "Create an account first.";
      return;
    }
    const payload = {
      displayName: form.elements.displayName.value,
      homeNeighborhood: form.elements.homeNeighborhood.value,
      favoriteCuisines: form.elements.favoriteCuisines.value,
      dietaryPreferences: form.elements.dietaryPreferences.value,
      diningOccasions: form.elements.diningOccasions.value,
      pricePreference: form.elements.pricePreference.value,
      bio: form.elements.bio.value
    };
    $("#preferenceStatus").textContent = "Saving eating profile...";
    try {
      const data = await api("/api/profile", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      state.userProfile = normalizeUserProfile(data.profile);
      renderAccount();
      renderPreferenceForm();
      $("#preferenceStatus").textContent = "Eating profile saved.";
    } catch (error) {
      $("#preferenceStatus").textContent = error.message;
    }
  });

  $("#notificationForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!state.account) {
      $("#notificationStatus").textContent = "Create a profile first.";
      return;
    }
    const payload = {
      hot_new: form.elements.hot_new.checked,
      awarded: form.elements.awarded.checked,
      essential: form.elements.essential.checked,
      iconic: form.elements.iconic.checked,
      frequency: form.elements.frequency.value
    };
    try {
      const data = await api("/api/subscriptions", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      applySubscription(data.subscription);
      $("#notificationStatus").textContent = "Notification settings saved.";
    } catch (error) {
      $("#notificationStatus").textContent = error.message;
    }
  });

  let searchDebounce;
  $("#searchInput").addEventListener("input", (event) => {
    state.search = event.target.value;
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(render, 150);
  });
  $("#neighborhoodSelect").addEventListener("change", (event) => {
    state.neighborhood = event.target.value;
    render();
  });
  $("#noveltyRange").addEventListener("input", (event) => {
    state.novelty = Number(event.target.value);
    $("#noveltyValue").textContent = state.novelty;
    render();
  });
  $("#sortSelect").addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
  document.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-detail-close]");
    if (closeButton || event.target === $("#detailOverlay")) {
      closeDetail();
      return;
    }

    const menuButton = event.target.closest("[data-card-menu]");
    if (menuButton) {
      const actions = menuButton.closest(".restaurant-actions");
      const isOpen = actions.classList.contains("menu-open");
      document.querySelectorAll(".restaurant-actions.menu-open").forEach((row) => {
        row.classList.remove("menu-open");
        row.querySelector("[data-card-menu]")?.setAttribute("aria-expanded", "false");
      });
      actions.classList.toggle("menu-open", !isOpen);
      menuButton.setAttribute("aria-expanded", String(!isOpen));
      return;
    }

    if (!event.target.closest(".restaurant-actions")) {
      document.querySelectorAll(".restaurant-actions.menu-open").forEach((row) => {
        row.classList.remove("menu-open");
        row.querySelector("[data-card-menu]")?.setAttribute("aria-expanded", "false");
      });
    }

    const areaFilter = event.target.closest("[data-area-filter]");
    if (areaFilter) {
      state.neighborhood = areaFilter.dataset.areaFilter;
      $("#neighborhoodSelect").value = state.neighborhood;
      closeDetail();
      render();
      $("#restaurantCards").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const action = event.target.closest("[data-action]");
    if (action) {
      toggleArrayValue(action.dataset.action, action.dataset.id);
      return;
    }

    const recommend = event.target.closest("[data-recommend-restaurant]");
    if (recommend) {
      openRecommendDialog(recommend.dataset.recommendRestaurant);
      return;
    }

    if (event.target.closest(".action-menu")) return;

    const restaurantOpen = event.target.closest("[data-restaurant-open]");
    if (restaurantOpen) {
      openRestaurantDetail(restaurantOpen.dataset.restaurantOpen);
      return;
    }

    const lane = event.target.closest("[data-lane]");
    if (lane) {
      state.lane = lane.dataset.lane;
      document.querySelectorAll("[data-lane]").forEach((button) => {
        const active = button.dataset.lane === state.lane;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      render();
      return;
    }

    const filter = event.target.closest("[data-filter]");
    if (filter) {
      const set = filter.dataset.filter === "occasion" ? state.occasions : state.cuisines;
      if (set.has(filter.dataset.value)) set.delete(filter.dataset.value);
      else set.add(filter.dataset.value);
      const active = filter.classList.toggle("active");
      filter.setAttribute("aria-pressed", String(active));
      render();
    }

    const viewButton = event.target.closest("[data-view-button]");
    if (viewButton) switchView(viewButton.dataset.viewButton);

    const mapZoom = event.target.closest("[data-map-zoom]");
    if (mapZoom) {
      state.mapZoom = Math.max(10, Math.min(14, state.mapZoom + (mapZoom.dataset.mapZoom === "in" ? 1 : -1)));
      renderMap(filteredRestaurants());
    }

    const metric = event.target.closest("[data-metric-action]");
    if (metric) {
      handleMetricAction(metric.dataset.metricAction);
    }
  });

  document.addEventListener("submit", (event) => {
    const recommendForm = event.target.closest("#recommendForm");
    if (recommendForm) {
      event.preventDefault();
      sendRecommendation(recommendForm);
    }
  });

  document.addEventListener("keydown", (event) => {
    const overlayActive = $("#detailOverlay").classList.contains("active");
    if (event.key === "Escape" && overlayActive) {
      closeDetail();
      return;
    }
    if (event.key === "Tab" && overlayActive) {
      const focusables = $("#detailPanel").querySelectorAll(
        "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])"
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!$("#detailPanel").contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  $("#refreshScores").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await Promise.all([loadAccount(), loadIngestionStatus()]);
    } finally {
      button.disabled = false;
    }
  });
  $("#homeButton").addEventListener("click", () => switchView("discover"));
}

function renderDataCurrency() {
  const latest = RESTAURANTS.map((r) => r.opened).sort().at(-1);
  if (!latest) return;
  const date = new Date(`${latest}T12:00:00`);
  if (Number.isNaN(date.getTime())) return;
  $("#dataCurrency").textContent = date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function openDeepLink(id) {
  if (RESTAURANTS.some((restaurant) => restaurant.id === id)) {
    openRestaurantDetail(id);
    return;
  }
  openDetail(`
    <div class="detail-hero" style="--tone:var(--blue)">
      <div class="detail-top">
        <div>
          <span class="badge">Link</span>
          <h2 id="detailTitle">Restaurant not found</h2>
          <div>This link points at a restaurant that is not in the current dataset.</div>
        </div>
        <button class="detail-close" type="button" data-detail-close aria-label="Close details">×</button>
      </div>
    </div>
    <div class="detail-body">
      <section class="detail-section">
        <p class="hint">It may have been renamed or removed from the seed data. Browse the lanes or search to find it.</p>
      </section>
    </div>
  `);
}

setupFilters();
bindEvents();
renderAccount();
renderPreferenceForm();
renderDataCurrency();
loadAccount();
loadIngestionStatus();
render();
const initialRestaurant = new URLSearchParams(window.location.search).get("restaurant");
if (initialRestaurant) openDeepLink(initialRestaurant);
