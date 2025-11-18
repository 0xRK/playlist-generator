const axios = require('axios');

const MARKET = process.env.SPOTIFY_MARKET || 'US';

/**
 * Mood buckets mapped to search queries. Each query is tried in order until Spotify
 * returns recommendations; the final fallback is the mood label itself.
 */
const MOOD_PRESETS = {
  flow: {
    queries: ['"deep focus"', 'chill instrumental', 'ambient focus'],
  },
  amped: {
    queries: ['high energy workout', 'edm bangers', 'alt rock hype'],
  },
  recovery: {
    queries: ['calm acoustic sleep', 'lofi meditation', 'piano relaxation'],
  },
  reset: {
    queries: ['feel good indie', 'uplifting pop', 'jazzy morning'],
  },
};

const FALLBACK_TRACKS = {
  flow: [
    { id: 'flow-1', name: 'Deep Focus Echoes', artists: ['Analog Atlas'], externalUrl: null, preview_url: null },
    { id: 'flow-2', name: 'Glider State', artists: ['Marin'], externalUrl: null, preview_url: null },
  ],
  amped: [
    { id: 'amped-1', name: 'Voltage Push', artists: ['Strobe City'], externalUrl: null, preview_url: null },
    { id: 'amped-2', name: 'Sprintline', artists: ['Pulse Engine'], externalUrl: null, preview_url: null },
  ],
  recovery: [
    { id: 'recovery-1', name: 'Soft Reset', artists: ['Quiet Season'], externalUrl: null, preview_url: null },
    { id: 'recovery-2', name: 'Blue Hour Drift', artists: ['Cumulus'], externalUrl: null, preview_url: null },
  ],
  reset: [
    { id: 'reset-1', name: 'New Ground', artists: ['Vista Bloom'], externalUrl: null, preview_url: null },
    { id: 'reset-2', name: 'Field Notes', artists: ['Lucent'], externalUrl: null, preview_url: null },
  ],
};

function getPreset(label) {
  return MOOD_PRESETS[label] || MOOD_PRESETS.reset;
}

/**
 * Normalise Spotify's track payload into the lean shape the client expects.
 */
function mapTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artists: track.artists?.map(artist => artist.name) || [],
    preview_url: track.preview_url,
    uri: track.uri,
    externalUrl: track.external_urls?.spotify || null,
    albumArt: track.album?.images?.[1]?.url || track.album?.images?.[0]?.url || null,
  };
}

/**
 * Wrapper around Spotify's search API so we can swap out the query list, market,
 * or limit without touching the route layer.
 */
async function searchTracks(accessToken, query, limit = 20) {
  const response = await axios.get('https://api.spotify.com/v1/search', {
    headers: { Authorization: `Bearer ${accessToken}` },
    params: {
      q: query,
      type: 'track',
      limit,
      market: MARKET,
    },
  });

  return response.data?.tracks?.items || [];
}

async function fetchLiveTracks(accessToken, mood) {
  const preset = getPreset(mood.label);
  const attempts = [...(preset?.queries || []), mood.label];

  for (const query of attempts.filter(Boolean)) {
    try {
      const items = await searchTracks(accessToken, query, 20);
      if (items.length) {
        return {
          source: 'spotify-search',
          query,
          tracks: items.map(mapTrack),
        };
      }
    } catch (error) {
      console.warn('Spotify search API error', {
        status: error.response?.status,
        data: error.response?.data,
        query,
        message: error.message,
      });
      if (error.response?.status === 401) {
        const err = new Error('Spotify token expired');
        err.status = 401;
        throw err;
      }
    }
  }

  const err = new Error('Spotify search returned no tracks');
  err.status = 502;
  throw err;
}

function getFallbackTracks(label) {
  return FALLBACK_TRACKS[label] || FALLBACK_TRACKS.reset;
}

module.exports = {
  fetchLiveTracks,
  getFallbackTracks,
};

