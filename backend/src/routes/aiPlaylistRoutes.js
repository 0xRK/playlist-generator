const express = require('express');
const openaiService = require('../services/openaiService');
const spotifyService = require('../services/spotifyService');
const weatherService = require('../services/weatherService');
const { getAggregatedMetrics } = require('../store/inMemoryStore');

const router = express.Router();

/**
 * POST /api/ai-playlists
 * 
 * Generates a personalized playlist using OpenAI to analyze biometric data and calendar events.
 * 
 * Request body:
 * {
 *   accessToken: string (optional - Spotify access token),
 *   calendarBusyLevel: number (optional - daily busyness level 0-100),
 *   biometricOverride: Object (optional - custom biometric data instead of stored data),
 *   userInput: string (optional - user's text input/preferences),
 *   businessContext: Object (optional - work/business context)
 * }
 * 
 * Response:
 * {
 *   aiAnalysis: { mood, energy, valence, tempo, genres, searchQuery, reasoning },
 *   tracks: Array,
 *   source: string,
 *   biometricData: Object
 * }
 */
router.post('/', async (req, res, next) => {
  try {
    const { accessToken, calendarEvents = [], biometricOverride, weatherData = {}, userMoodPreference = '' } = req.body || {};

    // Get biometric data (either from override or stored data)
    let biometricData;
    if (biometricOverride) {
      biometricData = biometricOverride;
    } else {
      biometricData = getAggregatedMetrics();
      if (!biometricData) {
        return res.status(400).json({ 
          message: 'No biometric data available. Please sync wearable data first or provide biometricOverride.' 
        });
      }
    }

    // Fetch current weather data
    // const weatherData = await weatherService.fetchCurrentWeather();

    // Step 1: Get AI analysis and recommendations
    console.log('Requesting OpenAI analysis...');
    const aiAnalysis = await openaiService.analyzeAndGeneratePlaylistParams(
      biometricData,
      calendarEvents,
      weatherData,
      userMoodPreference
    );

    console.log('OpenAI recommendations:', aiAnalysis);

    // Step 2: Use AI recommendations to fetch Spotify tracks
    let tracks;
    let source;

    if (accessToken) {
      try {
        const mood = { 
          label: aiAnalysis.mood, 
          playlistHints: {
            searchQuery: aiAnalysis.searchQuery,
            seedGenres: aiAnalysis.genres
          }
        };
        const result = await spotifyService.fetchLiveTracks(accessToken, mood, true);
        tracks = result.tracks;
        source = result.source;
      } catch (spotifyError) {
        console.warn('Spotify live playlist failed, using fallback tracks', spotifyError.message);
        tracks = spotifyService.getFallbackTracks(aiAnalysis.mood);
        source = 'fallback';
      }
    } else {
      tracks = spotifyService.getFallbackTracks(aiAnalysis.mood);
      source = 'fallback-no-token';
    }

    res.json({
      aiAnalysis,
      tracks,
      source,
      weatherData,
      userInput,
      businessContext,
      biometricData: {
        providers: biometricData.providers,
        metrics: biometricData.metrics,
        lastUpdated: biometricData.lastUpdated,
        sampleCount: biometricData.sampleCount
      }
    });

  } catch (error) {
    console.error('AI Playlist Generation Error:', error);
    next(error);
  }
});

/**
 * POST /api/ai-playlists/analyze-only
 * 
 * Gets AI analysis without fetching Spotify tracks (useful for testing)
 * 
 * Request body:
 * {
 *   calendarBusyLevel: number (optional - daily busyness level 0-100),
 *   biometricOverride: Object (optional),
 *   userInput: string (optional),
 *   businessContext: Object (optional)
 * }
 */
router.post('/analyze-only', async (req, res, next) => {
  try {
    const { calendarEvents = [], biometricOverride, weatherData = {},userMoodPreference = '' } = req.body || {};

    let biometricData;
    if (biometricOverride) {
      biometricData = biometricOverride;
    } else {
      biometricData = getAggregatedMetrics();
      if (!biometricData) {
        return res.status(400).json({ 
          message: 'No biometric data available. Please sync wearable data first or provide biometricOverride.' 
        });
      }
    }

    // Fetch current weather data
    // const weatherData = await weatherService.fetchCurrentWeather();

    const aiAnalysis = await openaiService.analyzeAndGeneratePlaylistParams(
      biometricData,
      calendarEvents,
      weatherData,
      userMoodPreference
    );

    res.json({
      aiAnalysis,
      weatherData,
      userInput,
      businessContext,
      biometricData: {
        providers: biometricData.providers,
        metrics: biometricData.metrics,
        lastUpdated: biometricData.lastUpdated,
        sampleCount: biometricData.sampleCount
      }
    });

  } catch (error) {
    console.error('AI Analysis Error:', error);
    next(error);
  }
});

module.exports = router;

