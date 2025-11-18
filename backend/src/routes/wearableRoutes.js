const express = require('express');
const { normalize, adapters } = require('../services/wearableAdapters');
const {
  setWearableData,
  getWearableData,
  getAggregatedMetrics,
  setMoodSnapshot,
} = require('../store/inMemoryStore');
const { inferMood } = require('../services/moodModel');

const router = express.Router();

router.get('/providers', (_req, res) => {
  res.json({ providers: adapters });
});

router.get('/latest', (_req, res) => {
  res.json({ data: getWearableData(), aggregated: getAggregatedMetrics() });
});

router.post('/sync', (req, res, next) => {
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
    const mood = inferMood(latestSnapshot);
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

module.exports = router;

