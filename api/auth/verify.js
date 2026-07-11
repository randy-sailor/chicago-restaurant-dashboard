import { query } from "../_lib/db.js";
import { createSessionCookie } from "../_lib/session.js";
import { assertMethod, handleError, readJson, sendJson } from "../_lib/http.js";
import { sendEmail } from "../_lib/email.js";
import { profileReadyEmail } from "../_lib/emailTemplates.js";
import { codesMatch, hashLoginCode } from "../_lib/loginCodes.js";

const MAX_ATTEMPTS = 5;

export default async function handler(req, res) {
  try {
    assertMethod(req, "POST");
    const body = await readJson(req);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    if (!email || !/^\d{6}$/.test(code)) {
      throw Object.assign(new Error("Enter the 6-digit code from your email."), { statusCode: 400 });
    }

    const userResult = await query(`select id, email, verified_at from users where email = $1`, [email]);
    const user = userResult.rows[0];
    const invalidError = Object.assign(
      new Error("That code is invalid or expired. Request a new one."),
      { statusCode: 401 }
    );
    if (!user) throw invalidError;

    const codeResult = await query(
      `select id, code_hash, attempts
       from login_codes
       where user_id = $1 and consumed_at is null and expires_at > now()
       order by created_at desc
       limit 1`,
      [user.id]
    );
    const pending = codeResult.rows[0];
    if (!pending || pending.attempts >= MAX_ATTEMPTS) throw invalidError;

    if (!codesMatch(hashLoginCode(code), pending.code_hash)) {
      await query(`update login_codes set attempts = attempts + 1 where id = $1`, [pending.id]);
      throw invalidError;
    }

    await query(`update login_codes set consumed_at = now() where id = $1`, [pending.id]);
    await query(`update users set last_seen_at = now() where id = $1`, [user.id]);
    await query(
      `insert into subscriptions (user_id) values ($1) on conflict (user_id) do nothing`,
      [user.id]
    );

    // Welcome email only on the first successful verification.
    let emailStatus = { sent: false };
    if (!user.verified_at) {
      await query(`update users set verified_at = now() where id = $1`, [user.id]);
      try {
        const welcome = profileReadyEmail();
        await sendEmail({
          to: user.email,
          subject: welcome.subject,
          text: welcome.text,
          html: welcome.html
        });
        emailStatus = { sent: true };
      } catch (emailError) {
        emailStatus = { sent: false, error: "Profile created, but the welcome email could not be sent yet." };
        console.error("[auth/verify:email]", {
          message: emailError.message,
          statusCode: emailError.statusCode,
          code: emailError.code
        });
      }
    }

    sendJson(
      res,
      200,
      { user: { id: user.id, email: user.email }, email: emailStatus },
      { "Set-Cookie": createSessionCookie(user) }
    );
  } catch (error) {
    handleError(res, error);
  }
}
