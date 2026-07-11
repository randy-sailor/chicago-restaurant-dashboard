import { clearSessionCookie } from "../_lib/session.js";
import { assertMethod, handleError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    assertMethod(req, "POST");
    sendJson(res, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  } catch (error) {
    handleError(res, error);
  }
}
