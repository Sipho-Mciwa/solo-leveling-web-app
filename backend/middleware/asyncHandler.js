const { logger } = require('../utils/logger');
const { AppError } = require('../utils/AppError');

// Wraps an async route handler: known AppErrors are sent to the client as-is
// (safe, curated messages). Any other error is logged with full detail
// server-side and a generic message is sent to the client (no internal leakage).
function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
      }
      logger.error({ err, path: req.originalUrl, userId: req.userId }, 'Unhandled route error');
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = { asyncHandler };
