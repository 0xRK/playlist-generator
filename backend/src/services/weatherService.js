const axios = require("axios");

// NOTE: You would normally configure API_KEY and coordinates in your .env file.
const API_KEY = process.env.WEATHER_API_KEY;
const LAT = process.env.WEATHER_LAT || "40.8136"; // Default to Lincoln, NE
const LON = process.env.WEATHER_LON || "-96.7026"; // Default to Lincoln, NE
const LOCATION_NAME = process.env.WEATHER_LOCATION || "Lincoln,NE";

/**
 * Fetches current weather using OpenWeatherMap Current Weather API 2.5
 * Uses latitude and longitude for more accurate weather data
 */
async function fetchCurrentWeather() {
  if (!API_KEY) {
    // Using mock data for development
    return {
      location: LOCATION_NAME,
      temperature: 62,
      condition: "Partly Cloudy",
      description: "A cool, brisk day",
      isRaining: false,
      isOvercast: true,
    };
  }

  try {
    // OpenWeatherMap Current Weather API 2.5 (free tier)
    const API_URL = "https://api.openweathermap.org/data/2.5/weather";
    const response = await axios.get(API_URL, {
      params: {
        lat: LAT,
        lon: LON,
        appid: API_KEY,
        units: "imperial", // Fahrenheit
      },
    });

    const data = response.data;

    return {
      location: data.name || LOCATION_NAME,
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      description: data.weather[0].description,
      isRaining:
        data.weather[0].main.toLowerCase().includes("rain") ||
        data.weather[0].main.toLowerCase().includes("drizzle"),
      isOvercast: data.clouds.all > 75,
    };
  } catch (error) {
    console.error("Weather API Error:", error.response?.data || error.message);

    // Fallback to mock data if API fails
    return {
      location: LOCATION_NAME,
      temperature: 62,
      condition: "Unknown",
      description: "Weather data unavailable",
      isRaining: false,
      isOvercast: false,
    };
  }
}

module.exports = {
  fetchCurrentWeather,
};
