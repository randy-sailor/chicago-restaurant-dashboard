export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email:dry-run] ${subject} -> ${to}`);
    return { dryRun: true };
  }

  const payload = {
    from: process.env.EMAIL_FROM || "Chicago Restaurant Dashboard <updates@example.com>",
    to,
    subject,
    html,
    text
  };
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`Email provider failed: ${detail}`), { statusCode: 502 });
  }

  return response.json();
}
