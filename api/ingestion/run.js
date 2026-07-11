import { runSourceIngestion } from "../_lib/ingestion.js";
import { handleError, sendJson } from "../_lib/http.js";

function requireCronSecret(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  const vercelCron = req.headers["x-vercel-cron"] === "1";
  if (!vercelCron && supplied !== expected) {
    throw Object.assign(new Error("Forbidden."), { statusCode: 403 });
  }
}

export default async function handler(req, res) {
  try {
    if (!["GET", "POST"].includes(req.method)) {
      throw Object.assign(new Error("Use GET or POST."), { statusCode: 405 });
    }
    requireCronSecret(req);
    const result = await runSourceIngestion();
    sendJson(res, 200, result);
  } catch (error) {
    handleError(res, error);
  }
}
