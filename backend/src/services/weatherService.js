const axios = require("axios");

// NOTE: You would normally configure API_KEY and LOCATION in your .env file.
const API_KEY = process.env.WEATHER_API_KEY;
const LOCATION = process.env.WEATHER_LOCATION || "Omaha,NE";

/**
 * Mocks a simplified weather object to be passed to the mood model.
 * In a real application, you would replace this with an actual API call.
 */
async function fetchCurrentWeather() {
  //     if (!API_KEY) {
  //   // Using mock data for development
  return {
    location: LOCATION,
    temperature: 62,
    condition: "Partly Cloudy",
    description: "A cool, brisk day",
    isRaining: false,
    isOvercast: true,
  };
    };

  // --- Real API Call Placeholder ---

  //   const API_URL = "http://api.openweathermap.org/data/2.5/weather";
  //   const response = await axios.get(API_URL, {
  //     params: {
  //       q: LOCATION,
  //       appid: API_KEY,
  //       units: "imperial", // or 'metric'
  //     },
  //   });

  //   const data = response.data;
  //   return {
  //     location: data.name,
  //     temperature: data.main.temp,
  //     condition: data.weather[0].main,
  //     description: data.weather[0].description,
  //     isRaining: data.weather[0].main.toLowerCase().includes("rain"),
  //     isOvercast: data.clouds.all > 75,
  //   };
  // }

  module.exports = {
    fetchCurrentWeather,
  };

