const SITE_URL = process.env.SITE_URL || "https://chicagorestaurantdashboard.com";

const palette = {
  bg: "#f5f2ec",
  surface: "#fffdf8",
  surface2: "#ece7dc",
  ink: "#171615",
  muted: "#6c675f",
  line: "#ddd6cb",
  tomato: "#c94f31",
  green: "#26735f",
  blue: "#2f6190",
  gold: "#b98024"
};

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function eventLabel(type) {
  return {
    announced: "Newly announced",
    awarded: "Awarded",
    captured: "Newly captured"
  }[type] || "Update";
}

function itemCard(item) {
  const href = item.sourceUrl || SITE_URL;
  return `
    <tr>
      <td style="padding:0 0 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${palette.line};border-radius:8px;background:${palette.surface};">
          <tr>
            <td style="padding:16px 16px 14px 16px;">
              <div style="font:700 11px/1.2 Arial, sans-serif;text-transform:uppercase;color:${palette.tomato};letter-spacing:.08em;">${esc(eventLabel(item.eventType))}</div>
              <div style="font:800 22px/1.2 Arial, sans-serif;color:${palette.ink};margin-top:5px;">${esc(item.restaurantName)}</div>
              ${item.sourceTitle ? `<div style="font:14px/1.45 Arial, sans-serif;color:${palette.muted};margin-top:8px;">${esc(item.sourceTitle)}</div>` : ""}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;">
                <tr>
                  <td style="border-radius:6px;background:${palette.ink};">
                    <a href="${esc(href)}" style="display:inline-block;padding:10px 13px;font:700 13px/1 Arial, sans-serif;color:${palette.surface};text-decoration:none;">View source</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function shell({ preview, eyebrow, title, intro, children, footerNote, ctaLabel = "Open dashboard", ctaUrl = SITE_URL }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>${esc(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${palette.bg};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preview)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.bg};">
      <tr>
        <td align="center" style="padding:28px 14px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;border:1px solid ${palette.line};border-radius:8px;overflow:hidden;background:${palette.surface};">
            <tr>
              <td style="padding:18px 20px;border-bottom:1px solid ${palette.line};background:${palette.surface};">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="width:34px;height:34px;border-radius:8px;background:${palette.ink};color:${palette.surface};font:800 18px/34px Arial, sans-serif;text-align:center;">C</td>
                          <td style="padding-left:10px;font:800 15px/1.2 Arial, sans-serif;color:${palette.ink};">Chicago Restaurant Dashboard</td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="font:700 11px/1.2 Arial, sans-serif;text-transform:uppercase;letter-spacing:.08em;color:${palette.muted};">Dining Signal</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 20px 8px 20px;background:${palette.surface};">
                <div style="font:800 11px/1.2 Arial, sans-serif;text-transform:uppercase;letter-spacing:.08em;color:${palette.green};">${esc(eyebrow)}</div>
                <h1 style="margin:8px 0 0 0;font:800 30px/1.08 Arial, sans-serif;color:${palette.ink};letter-spacing:0;">${esc(title)}</h1>
                <p style="margin:12px 0 0 0;font:16px/1.5 Arial, sans-serif;color:${palette.muted};">${esc(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 20px 8px 20px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${children}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:10px 20px 28px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:6px;background:${palette.tomato};">
                      <a href="${esc(ctaUrl)}" style="display:inline-block;padding:12px 15px;font:800 14px/1 Arial, sans-serif;color:#ffffff;text-decoration:none;">${esc(ctaLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:18px 0 0 0;font:12px/1.45 Arial, sans-serif;color:${palette.muted};">${esc(footerNote || "You are receiving this because you created a Chicago Restaurant Dashboard profile.")}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function profileReadyEmail() {
  return {
    subject: "Your Chicago Restaurant Dashboard profile is ready",
    text: [
      "Your Chicago Restaurant Dashboard profile is ready.",
      "Save restaurants, mark places visited or passed, and receive updates when notable Chicago dining news lands.",
      `Open the dashboard: ${SITE_URL}`
    ].join("\n\n"),
    html: shell({
      preview: "Your Chicago Restaurant Dashboard profile is ready.",
      eyebrow: "Profile ready",
      title: "Your dining signal is live",
      intro: "Start saving restaurants, marking what you have tried, and shaping future recommendations around how you actually like to eat.",
      children: `
        <tr>
          <td style="padding:0 0 12px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${palette.line};border-radius:8px;background:${palette.surface2};">
              <tr>
                <td style="padding:16px;font:15px/1.5 Arial, sans-serif;color:${palette.ink};">
                  Use Save, Visited, and Pass on restaurant cards. Over time, those signals make the dashboard more personal.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `,
      footerNote: "You can update notification preferences from the Profile view."
    })
  };
}

export function restaurantDigestEmail(events) {
  const items = events.map((event) => ({
    restaurantName: event.restaurant_name,
    eventType: event.event_type,
    sourceTitle: event.source_title,
    sourceUrl: event.source_url
  }));
  return {
    subject: "Chicago restaurant updates",
    text: [
      "New restaurant updates matching your preferences:",
      ...items.map((item) => `${item.restaurantName} - ${eventLabel(item.eventType)}${item.sourceUrl ? `: ${item.sourceUrl}` : ""}`),
      `Open the dashboard: ${SITE_URL}`
    ].join("\n"),
    html: shell({
      preview: `${items.length} Chicago restaurant update${items.length === 1 ? "" : "s"} matched your preferences.`,
      eyebrow: "Restaurant updates",
      title: "New dining signals to scan",
      intro: "These updates matched your notification preferences across new openings, awards, and captured places.",
      children: items.map(itemCard).join(""),
      footerNote: "Notification preferences can be changed from your dashboard profile."
    })
  };
}

export function restaurantRecommendationEmail({ restaurant, senderEmail, message, restaurantUrl }) {
  const menu = Array.isArray(restaurant.menu) ? restaurant.menu.slice(0, 4) : [];
  const sender = senderEmail || "Someone";
  const note = String(message || "").trim();
  const card = `
    <tr>
      <td style="padding:0 0 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${palette.line};border-radius:8px;background:${palette.surface};">
          <tr>
            <td style="padding:16px 16px 14px 16px;">
              <div style="font:700 11px/1.2 Arial, sans-serif;text-transform:uppercase;color:${palette.tomato};letter-spacing:.08em;">Recommended restaurant</div>
              <div style="font:800 24px/1.18 Arial, sans-serif;color:${palette.ink};margin-top:5px;">${esc(restaurant.name)}</div>
              <div style="font:14px/1.45 Arial, sans-serif;color:${palette.muted};margin-top:7px;">${esc(restaurant.neighborhood)} · ${esc(restaurant.format)}</div>
              <div style="font:14px/1.45 Arial, sans-serif;color:${palette.muted};margin-top:3px;">${esc(restaurant.address || "Chicago")}</div>
              ${restaurant.note ? `<p style="margin:12px 0 0 0;font:15px/1.5 Arial, sans-serif;color:${palette.ink};">${esc(restaurant.note)}</p>` : ""}
              ${menu.length ? `<ul style="margin:12px 0 0 18px;padding:0;font:13px/1.5 Arial, sans-serif;color:${palette.muted};">${menu.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
  const senderNote = note ? `
    <tr>
      <td style="padding:0 0 12px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${palette.line};border-radius:8px;background:${palette.surface2};">
          <tr>
            <td style="padding:16px;font:15px/1.5 Arial, sans-serif;color:${palette.ink};">
              <strong style="display:block;margin-bottom:6px;">A note from ${esc(sender)}</strong>
              ${esc(note)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : "";

  return {
    subject: `${sender} thinks you should try ${restaurant.name}`,
    text: [
      `${sender} thinks you should try ${restaurant.name}.`,
      restaurant.note || "",
      note ? `Note from ${sender}: ${note}` : "",
      `View it on Chicago Restaurant Dashboard: ${restaurantUrl}`
    ].filter(Boolean).join("\n\n"),
    html: shell({
      preview: `${sender} recommended ${restaurant.name} on Chicago Restaurant Dashboard.`,
      eyebrow: "Restaurant recommendation",
      title: `${restaurant.name} is worth a look`,
      intro: `${sender} sent you a Chicago dining recommendation with menu and source context from the dashboard.`,
      children: `${senderNote}${card}`,
      footerNote: "This recommendation was sent from Chicago Restaurant Dashboard.",
      ctaLabel: "View restaurant",
      ctaUrl: restaurantUrl
    })
  };
}
