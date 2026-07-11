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
    let providerMessage = detail;
    try {
      const parsed = JSON.parse(detail);
      providerMessage = parsed.message || parsed.error || detail;
    } catch {
      providerMessage = detail;
    }
    const isResendTestingMode = response.status === 403 && /verify a domain|testing emails/i.test(providerMessage);
    const message = isResendTestingMode
      ? "Email sending is still in Resend testing mode. Verify your sending domain in Resend, then set EMAIL_FROM to an address on that domain."
      : `Email provider failed: ${providerMessage}`;
    throw Object.assign(new Error(message), { statusCode: isResendTestingMode ? 403 : 502 });
  }

  return response.json();
}
