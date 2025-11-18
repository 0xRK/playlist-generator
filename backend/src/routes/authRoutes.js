const express = require('express');
const axios = require('axios');
const querystring = require('querystring');

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

module.exports = router;

