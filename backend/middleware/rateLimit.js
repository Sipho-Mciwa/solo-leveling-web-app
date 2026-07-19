const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const keyByUserOrIp = (req) => req.userId || ipKeyGenerator(req);

// General limiter for authenticated API traffic — generous enough for normal
// use, tight enough to blunt a scripted hammering of mutating endpoints.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: 'Too many requests, please slow down.' },
});

// Stricter limiter for routes that call paid third-party AI APIs.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  message: { error: 'Too many AI requests, please slow down.' },
});

module.exports = { apiLimiter, aiLimiter };
