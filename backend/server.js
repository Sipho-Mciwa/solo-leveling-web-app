require('dotenv').config();
const express = require('express');
const cors = require('cors');

const questRoutes      = require('./routes/questRoutes');
const userRoutes       = require('./routes/userRoutes');
const analyticsRoutes  = require('./routes/analyticsRoutes');
const rankRoutes       = require('./routes/rankRoutes');
const penaltyRoutes    = require('./routes/penaltyRoutes');
const bossRoutes       = require('./routes/bossRoutes');
const challengeRoutes  = require('./routes/challengeRoutes');

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.FRONTEND_URL, // primary production URL, e.g. https://solo-leveling-web-app.vercel.app
].filter(Boolean);

// Also allow any Vercel preview URL for this project (e.g. solo-leveling-web-app-xxxx.vercel.app)
const VERCEL_PREVIEW_PATTERN = /^https:\/\/solo-leveling-web-app(-[a-z0-9]+)?\.vercel\.app$/;

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin) || VERCEL_PREVIEW_PATTERN.test(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin '${origin}' not allowed`));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/quests',     questRoutes);
app.use('/api/users',      userRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/rank',       rankRoutes);
app.use('/api/penalty',    penaltyRoutes);
app.use('/api/boss',       bossRoutes);
app.use('/api/challenges', challengeRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
