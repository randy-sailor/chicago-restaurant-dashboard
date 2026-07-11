export function sendJson(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Invalid JSON body."), { statusCode: 400 });
  }
}

export function handleError(res, error) {
  const statusCode = error.statusCode || 500;
  sendJson(res, statusCode, {
    error: statusCode === 500 ? "Internal server error." : error.message
  });
}

export function assertMethod(req, method) {
  if (req.method !== method) {
    throw Object.assign(new Error(`Use ${method}.`), { statusCode: 405 });
  }
}
