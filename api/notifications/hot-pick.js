import { handleError, sendJson } from "../_lib/http.js";
import { requireCronSecret } from "../_lib/cron.js";
import { runHotPickSends } from "../_lib/hotPickSender.js";

// Manual trigger for the weekly hot pick. The scheduled path runs from the
// daily notifications cron (see api/notifications/digest.js) on Thursdays,
// because Vercel's Hobby plan allows at most two cron jobs per project.
export default async function handler(req, res) {
  try {
    requireCronSecret(req);
    sendJson(res, 200, await runHotPickSends());
  } catch (error) {
    handleError(res, error);
  }
}
