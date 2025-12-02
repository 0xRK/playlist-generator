const express = require('express');
const weatherService = require('../services/weatherService');

const router = express.Router();

/**
 * GET /api/weather
 * Fetches current weather data
 */
router.get('/', async (_req, res, next) => {
    try {
        const weather = await weatherService.fetchCurrentWeather();
        res.json(weather);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
