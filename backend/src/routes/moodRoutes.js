const express = require('express');
const {
  getAggregatedMetrics,
  getMoodSnapshot,
  setMoodSnapshot,
} = require('../store/inMemoryStore');
const { inferMood } = require('../services/moodModel');

const router = express.Router();

router.get('/', (_req, res) => {
  const mood = getMoodSnapshot();

  if (!mood) {
    return res.status(404).json({ message: 'No mood snapshot yet.' });
  }

  return res.json(mood);
});

router.post('/run', (_req, res, next) => {
  try {
    const aggregated = getAggregatedMetrics();
    const mood = inferMood(aggregated);
    setMoodSnapshot(mood);
    res.json({ mood, aggregated });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

