/* =====================================================================
   SAFE ERROR RESPONSES
   Real errors (MongoDB, network, code bugs) are logged to the SERVER
   console only. The browser only ever receives one of these plain messages.
   ===================================================================== */

export const SAFE_MESSAGES = {
  unavailable: "The service is temporarily unavailable. Please try again later.",
  generic: "Something went wrong. Please try again.",
  unprocessed: "We couldn't process your request. Please try again.",
};

const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "ECONNRESET",
  "EAI_AGAIN",
]);

const DB_ERROR_NAMES = new Set([
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoServerSelectionError",
  "MongooseServerSelectionError",
  "MongoTopologyClosedError",
  "MongoNotConnectedError",
]);

// True when the database (or the network path to it) is down, as opposed to
// a bug or a bad request.
export function isDatabaseUnavailable(err) {
  if (!err) return false;
  if (DB_ERROR_NAMES.has(err.name)) return true;
  if (NETWORK_CODES.has(err.code)) return true;
  return /buffering timed out|server selection|topology (was )?destroyed|ECONNREFUSED/i.test(
    String(err.message || "")
  );
}

// Logs the full error for developers, then sends only a safe message.
//   503 -> database/service unavailable
//   500 -> anything else (using the fallback message)
export function respondWithSafeError(
  res,
  err,
  context,
  fallbackMessage = SAFE_MESSAGES.generic
) {
  console.error(`${context}:`, err); // full details stay in the server log
  if (res.headersSent) return;
  if (isDatabaseUnavailable(err)) {
    return res.status(503).json({ error: SAFE_MESSAGES.unavailable });
  }
  return res.status(500).json({ error: fallbackMessage });
}