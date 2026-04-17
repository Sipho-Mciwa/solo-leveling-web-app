const express = require('express');
const router  = express.Router();
const { auth, db } = require('../config/firebase');
const { syncStravaActivities } = require('../services/stravaSync.service');

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(idToken);
    req.userId = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/strava/auth — returns the Strava OAuth URL for this user
router.get('/auth', authenticate, (req, res) => {
  const redirectUri = `${process.env.BACKEND_URL || 'http://localhost:4000'}/api/strava/callback`;
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id',       process.env.STRAVA_CLIENT_ID);
  url.searchParams.set('redirect_uri',    redirectUri);
  url.searchParams.set('response_type',   'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope',           'activity:read_all');
  url.searchParams.set('state',           req.userId);
  res.json({ url: url.toString() });
});

// GET /api/strava/callback — Strava redirects here after OAuth
router.get('/callback', async (req, res) => {
  const { code, state: userId, error } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  if (error || !code || !userId) {
    return res.redirect(`${frontendUrl}/dashboard?strava=error`);
  }

  try {
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:     process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return res.redirect(`${frontendUrl}/dashboard?strava=error`);
    }

    await db.collection('users').doc(userId).update({
      stravaTokens: {
        accessToken:  tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt:    tokenData.expires_at,
      },
    });

    res.redirect(`${frontendUrl}/dashboard?strava=connected`);
  } catch {
    res.redirect(`${frontendUrl}/dashboard?strava=error`);
  }
});

// GET /api/strava/status — check whether this user has connected Strava
router.get('/status', authenticate, async (req, res) => {
  try {
    const userSnap = await db.collection('users').doc(req.userId).get();
    const data     = userSnap.exists ? userSnap.data() : {};
    res.json({ connected: !!data.stravaTokens?.accessToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/strava/sync — fetch new Strava runs and auto-complete running quests
router.get('/sync', authenticate, async (req, res) => {
  try {
    const result = await syncStravaActivities(req.userId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/strava/sync-on-login — fire-and-forget sync triggered at login
// Returns immediately; sync runs in the background without blocking the login flow
router.post('/sync-on-login', authenticate, (req, res) => {
  res.json({ started: true });
  syncStravaActivities(req.userId).catch(() => {});
});

module.exports = router;
