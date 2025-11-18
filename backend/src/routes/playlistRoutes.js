const express = require('express');
const spotifyService = require('../services/spotifyService');
const { getMoodSnapshot } = require('../store/inMemoryStore');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { accessToken } = req.body || {};
    const mood = getMoodSnapshot();

    if (!mood) {
      return res.status(400).json({ message: 'Run mood detection before requesting a playlist.' });
    }

    let tracks;
    let source;

    if (accessToken) {
      try {
        const { tracks: liveTracks, source: liveSource } = await spotifyService.fetchLiveTracks(accessToken, mood);
        tracks = liveTracks;
        source = liveSource;
      } catch (spotifyError) {
        console.warn('Spotify live playlist failed, using fallback tracks', spotifyError.message);
        tracks = spotifyService.getFallbackTracks(mood.label);
        source = 'fallback';
      }
    } else {
      tracks = spotifyService.getFallbackTracks(mood.label);
      source = 'fallback';
    }

    res.json({
      mood,
      tracks,
      source,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

