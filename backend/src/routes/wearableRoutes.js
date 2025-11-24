const express = require('express');
const { normalize, adapters } = require('../services/wearableAdapters');
const {
  setWearableData,
  getWearableData,
  getAggregatedMetrics,
  setMoodSnapshot,
} = require('../store/inMemoryStore');
const { inferMood } = require('../services/moodModel');
const whoopService = require('../services/whoopService');

const router = express.Router();

router.get('/providers', (_req, res) => {
  res.json({ providers: adapters });
});

router.get('/latest', (_req, res) => {
  res.json({ data: getWearableData(), aggregated: getAggregatedMetrics() });
});

router.post('/sync', async (req, res, next) => {
  try {
    const { provider, payload } = req.body || {};

    if (!provider || !payload) {
      return res.status(400).json({ message: 'provider and payload are required' });
    }

    const normalized = normalize(provider, payload);
    setWearableData(provider, normalized);

    const aggregatedMetrics = getAggregatedMetrics();
    const latestSnapshot = {
      sampleCount: 1,
      providers: [provider],
      lastUpdated: new Date().toISOString(),
      metrics: normalized.metrics,
    };
    const mood = await inferMood(latestSnapshot);
    setMoodSnapshot(mood);

    res.json({
      provider,
      normalizedMetrics: normalized.metrics,
      aggregatedMetrics,
      mood,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Fetch Whoop data directly from API
 * Requires user to be authenticated with Whoop (via /auth/whoop/login)
 */
router.post('/whoop/fetch', async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId || 'default';

    // Check if user has stored tokens
    const storedTokens = whoopService.getStoredTokens(userId);
    if (!storedTokens || !storedTokens.accessToken) {
      return res.status(401).json({
        message: 'Whoop authentication required. Please authenticate at /auth/whoop/login',
        authUrl: `${req.protocol}://${req.get('host')}/auth/whoop/login?userId=${userId}`,
      });
    }

    // Fetch latest data from Whoop API
    const payload = await whoopService.fetchLatestData(userId);

    // Normalize the payload using the existing adapter
    const normalized = normalize('whoop', payload);
    setWearableData('whoop', normalized);

    const aggregatedMetrics = getAggregatedMetrics();
    const latestSnapshot = {
      sampleCount: 1,
      providers: ['whoop'],
      lastUpdated: new Date().toISOString(),
      metrics: normalized.metrics,
    };
    const mood = await inferMood(latestSnapshot);
    setMoodSnapshot(mood);

    res.json({
      provider: 'whoop',
      source: 'api',
      normalizedMetrics: normalized.metrics,
      aggregatedMetrics,
      mood,
      rawData: payload,
    });
  } catch (error) {
    if (error.message.includes('Authentication failed') || error.message.includes('No access token')) {
      return res.status(401).json({
        message: error.message,
        authUrl: `${req.protocol}://${req.get('host')}/auth/whoop/login?userId=${req.body.userId || 'default'}`,
      });
    }
    next(error);
  }
});

module.exports = router;

