const express = require('express');
const axios = require('axios');
const querystring = require('querystring');
const whoopService = require('../services/whoopService');

const router = express.Router();

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const CLIENT_URL = process.env.CLIENT_URL;

router.get('/login', (req, res) => {
  if (!CLIENT_ID || !REDIRECT_URI) {
    return res.status(500).json({ message: 'Missing Spotify auth configuration' });
  }

  const scope = [
    'playlist-modify-private',
    'playlist-modify-public',
    'user-read-recently-played',
  ].join(' ');

  const params = querystring.stringify({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope,
    redirect_uri: REDIRECT_URI,
    state: req.query.state || 'playlist-generator',
  });

  return res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.redirect(`${CLIENT_URL}?error=missing_code`);
  }

  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
        },
      },
    );

    const token = response.data.access_token;
    const redirectTarget = CLIENT_URL || 'http://localhost:5173';

    return res.redirect(`${redirectTarget}?access_token=${token}`);
  } catch (error) {
    console.error('Spotify auth failed', error.response?.data || error.message);
    return res.redirect(`${CLIENT_URL}?error=auth_failed`);
  }
});

router.get('/config', (_req, res) => {
  res.json({
    redirectUri: REDIRECT_URI,
    clientConfigured: Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI && CLIENT_URL),
  });
});

// Whoop OAuth routes
router.get('/whoop/login', (req, res) => {
  try {
    const userId = req.query.userId || 'default'; // In production, get from session/auth
    // Generate a proper 8+ character state (Whoop requires at least 8 characters)
    // Include userId in state so we can retrieve it in callback
    const state = whoopService.generateState() + '_' + userId.substring(0, 7);
    const authUrl = whoopService.getAuthorizationUrl(userId, state);
    return res.redirect(authUrl);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Whoop auth configuration error' });
  }
});

router.get('/whoop/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state || '';
  const error = req.query.error;
  const errorDescription = req.query.error_description;
  
  // Extract userId from state (format: "random8chars_userId")
  // If state doesn't contain userId, default to 'default'
  const userId = state.includes('_') ? state.split('_').slice(1).join('_') : 'default';

  // Log all query parameters for debugging
  console.log('Whoop OAuth Callback - Query params:', {
    code: code ? 'present' : 'missing',
    state,
    extractedUserId: userId,
    error,
    error_description: errorDescription,
    allParams: req.query,
  });

  // Check if Whoop returned an error
  if (error) {
    console.error('Whoop OAuth error:', error, errorDescription);
    const errorMsg = errorDescription || error;
    return res.redirect(`${CLIENT_URL}?error=whoop_oauth_error&details=${encodeURIComponent(errorMsg)}`);
  }

  if (!code) {
    console.error('Whoop OAuth callback missing authorization code');
    console.error('Full query string:', JSON.stringify(req.query));
    return res.redirect(`${CLIENT_URL}?error=whoop_missing_code`);
  }

  try {
    const tokens = await whoopService.exchangeCodeForToken(code);
    whoopService.storeTokens(userId, tokens);

    console.log('Whoop OAuth successful - tokens stored for userId:', userId);
    const redirectTarget = CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${redirectTarget}?whoop_auth=success&userId=${userId}`);
  } catch (error) {
    console.error('Whoop token exchange failed:', error.message);
    console.error('Error details:', error.response?.data || error);
    return res.redirect(`${CLIENT_URL}?error=whoop_auth_failed&details=${encodeURIComponent(error.message)}`);
  }
});

router.get('/whoop/config', (_req, res) => {
  res.json({
    whoopConfigured: Boolean(
      process.env.WHOOP_CLIENT_ID &&
      process.env.WHOOP_CLIENT_SECRET &&
      process.env.WHOOP_REDIRECT_URI
    ),
  });
});

module.exports = router;

