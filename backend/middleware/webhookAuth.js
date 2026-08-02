const crypto = require('crypto');

// Shortcuts automations can't complete an interactive Firebase sign-in, so
// webhook routes authenticate with a static shared secret instead of the
// `authenticate` middleware's Firebase ID token. The secret is compared with
// a constant-time check to avoid leaking its value via response-timing.
// req.userId is set from WEBHOOK_USER_ID since there's no token to decode it
// from — this is intended for a single-user (personal) deployment.
function webhookAuth(req, res, next) {
  const expectedSecret = process.env.WORKOUT_WEBHOOK_SECRET;
  const userId = process.env.WORKOUT_WEBHOOK_USER_ID;

  if (!expectedSecret || !userId) {
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const providedSecret = authHeader.slice('Bearer '.length);

  const expected = Buffer.from(expectedSecret);
  const provided = Buffer.from(providedSecret);
  const isValid =
    expected.length === provided.length && crypto.timingSafeEqual(expected, provided);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  req.userId = userId;
  next();
}

module.exports = { webhookAuth };
