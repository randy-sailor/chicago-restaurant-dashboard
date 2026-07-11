import { runSourceIngestion } from "../_lib/ingestion.js";
import { handleError, sendJson } from "../_lib/http.js";
import { requireCronSecret } from "../_lib/cron.js";

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
