const express = require('express');
const cors = require('cors');
const axios = require('axios');
const querystring = require('querystring');
require('dotenv').config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const CLIENT_URL = process.env.CLIENT_URL;

app.get('/login', (req, res) => {
  const scope = 'user-read-recently-played';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: CLIENT_ID,
      scope: scope,
      redirect_uri: REDIRECT_URI,
    }));
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      querystring.stringify({
        code: code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
        }
      }
    );

    res.redirect(CLIENT_URL + '?access_token=' + response.data.access_token);
  } catch (error) {
    res.redirect(CLIENT_URL + '?error=auth_failed');
  }
});

app.get('/top-tracks', async (req, res) => {
  const accessToken = req.headers.authorization?.split(' ')[1];
  
  try {
    const response = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params: { limit: 20 }
    });
    const items = response.data.items.map(item => item.track);
    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tracks' });
  }
});

app.listen(port, () => {
  console.log(`Backend server listening at http://localhost:${port}`);
});