const express = require('express');
const spotifyService = require('../services/spotifyService');
const { getMoodSnapshot, getAggregatedMetrics, getContextData } = require('../store/inMemoryStore');
const { analyzeAndGeneratePlaylistParams } = require('../services/openaiService');

const router = express.Router();

router.post('/', async (req, res, next) => {
  try {
    const { accessToken, useAI = true, weather, scheduleLoad, userInput } = req.body || {};
    let mood = getMoodSnapshot();

    if (!mood) {
      return res.status(400).json({ message: 'Run mood detection before requesting a playlist.' });
    }

    // If useAI is true and we have an OpenAI key, enhance the mood with AI-generated search query
    if (useAI && process.env.OPENAI_API_KEY) {
      try {
        const aggregatedMetrics = getAggregatedMetrics();
        const storedContext = getContextData();

        // Use context from request body if provided, otherwise fall back to stored context
        const contextData = {
          weather: weather || storedContext.weather,
          scheduleLoad: scheduleLoad !== undefined ? scheduleLoad : storedContext.scheduleLoad,
          userInput: userInput !== undefined ? userInput : storedContext.userInput,
        };

        if (aggregatedMetrics) {
          console.log('🤖 Using OpenAI to generate playlist search query...');

          // Transform schedule load to calendar events format
          const calendarEvents = [];
          if (contextData.scheduleLoad !== null && contextData.scheduleLoad !== undefined) {
            const loadPercent = Math.round(contextData.scheduleLoad * 100);
            const descriptions = {
              veryLight: 'Very light schedule - mostly free time',
              light: 'Light workload - some meetings',
              moderate: 'Moderate workload - balanced schedule',
              busy: 'Busy schedule - many commitments',
              veryBusy: 'Very heavy schedule - back-to-back events'
            };

            let description;
            if (contextData.scheduleLoad <= 0.2) description = descriptions.veryLight;
            else if (contextData.scheduleLoad <= 0.4) description = descriptions.light;
            else if (contextData.scheduleLoad <= 0.6) description = descriptions.moderate;
            else if (contextData.scheduleLoad <= 0.8) description = descriptions.busy;
            else description = descriptions.veryBusy;

            calendarEvents.push({
              title: `Daily workload: ${loadPercent}% busy`,
              description,
              type: 'schedule-summary'
            });
          }

          const aiResult = await analyzeAndGeneratePlaylistParams(
            aggregatedMetrics,
            calendarEvents,
            contextData.weather,
            contextData.userInput
          );

          mood = {
            ...mood,
            playlistHints: {
              ...mood.playlistHints,
              searchQuery: aiResult.searchQuery,
              seedGenres: aiResult.genres
            },
            source: 'openai'
          };
          console.log('✅ OpenAI search query:', aiResult.searchQuery);
        }
      } catch (aiError) {
        console.warn('OpenAI playlist enhancement failed, using heuristic mood:', aiError.message);
        // Continue with heuristic mood
      }
    }

    let tracks;
    let source;

    if (accessToken) {
      try {
        const { tracks: liveTracks, source: liveSource } = await spotifyService.fetchLiveTracks(accessToken, mood, useAI);
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

router.post('/save', async (req, res, next) => {
  try {
    const { accessToken, name, description, trackUris } = req.body || {};
    if (!accessToken) {
      return res.status(400).json({ message: 'accessToken is required to save a playlist.' });
    }
    if (!Array.isArray(trackUris) || !trackUris.length) {
      return res.status(400).json({ message: 'trackUris must be a non-empty array.' });
    }

    const playlist = await spotifyService.createPlaylist(accessToken, {
      name: name || 'Mood playlist',
      description: description || 'Generated via the WHOOP/Oura mood demo',
    });

    await spotifyService.addTracksToPlaylist(accessToken, playlist.id, trackUris);

    res.json({
      playlistId: playlist.id,
      playlistUrl: playlist.external_urls?.spotify,
      snapshotId: playlist.snapshot_id,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
