import crypto from "node:crypto";
import { query } from "../_lib/db.js";
import { assertMethod, handleError, readJson, sendJson } from "../_lib/http.js";
import { sendEmail } from "../_lib/email.js";
import { loginCodeEmail } from "../_lib/emailTemplates.js";
import { hashLoginCode } from "../_lib/loginCodes.js";

const CODE_TTL_MINUTES = 15;
const MAX_CODES_PER_WINDOW = 5;

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

    const recent = await query(
      `select count(*)::int as count
       from login_codes
       where user_id = $1 and created_at > now() - interval '15 minutes'`,
      [user.id]
    );
    if (recent.rows[0].count >= MAX_CODES_PER_WINDOW) {
      throw Object.assign(
        new Error("Too many sign-in codes requested. Wait a few minutes and try again."),
        { statusCode: 429 }
      );
    }

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    await query(
      `insert into login_codes (user_id, code_hash, expires_at)
       values ($1, $2, now() + interval '${CODE_TTL_MINUTES} minutes')`,
      [user.id, hashLoginCode(code)]
    );

    const message = loginCodeEmail(code);
    const delivery = await sendEmail({
      to: user.email,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
    if (delivery?.dryRun) {
      console.log(`[auth/register:dry-run] sign-in code for ${user.email}: ${code}`);
    }

    sendJson(res, 200, {
      pending: true,
      email: user.email,
      expiresInMinutes: CODE_TTL_MINUTES
    });
  } catch (error) {
    handleError(res, error);
  }
}
