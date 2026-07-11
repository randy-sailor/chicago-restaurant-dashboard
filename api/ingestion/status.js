import { latestIngestionStatus } from "../_lib/ingestion.js";
import { handleError, sendJson } from "../_lib/http.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      throw Object.assign(new Error("Use GET."), { statusCode: 405 });
    }
    sendJson(res, 200, await latestIngestionStatus());
  } catch (error) {
    handleError(res, error);
  }
}
