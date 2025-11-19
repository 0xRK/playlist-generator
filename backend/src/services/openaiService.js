const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * Analyzes biometric data, weather, business context, and calendar events using OpenAI
 * to generate personalized Spotify playlist parameters.
 *
 * @param {Object} biometricData - Wearable device data (HRV, sleep, strain, etc.)
 * @param {Number} calendarBusyLevel - Daily busyness level (0-100, where 100 is extremely busy)
 * @param {Object} weatherData - Current weather information
 * @param {String} userInput - User's text input/preferences
 * @param {Object} businessContext - Business/work context information
 * @returns {Promise<Object>} Playlist parameters for Spotify
 */
async function analyzeAndGeneratePlaylistParams(
  biometricData,
  calendarBusyLevel = 0,
  weatherData = null,
  userInput = "",
  businessContext = null
) {
  if (!OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured in environment variables"
    );
  }

  const prompt = buildPrompt(
    biometricData,
    calendarBusyLevel,
    weatherData,
    userInput,
    businessContext
  );

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: "gpt-4o-mini", // Using gpt-4o-mini for cost efficiency, can upgrade to gpt-4o for better results
        messages: [
          {
            role: "system",
            content: `You are an expert music therapist and data analyst. Your role is to analyze biometric data and daily schedules to recommend optimal music characteristics that will enhance productivity, mood, and wellbeing.

You must respond ONLY with valid JSON matching this exact structure:
{
  "mood": "flow" | "amped" | "recovery" | "reset",
  "energy": 0.0-1.0,
  "valence": 0.0-1.0,
  "tempo": 60-200,
  "genres": ["genre1", "genre2"],
  "searchQuery": "string",
  "reasoning": "brief explanation of your recommendations"
}

Guidelines:
- energy: 0.0 (calm) to 1.0 (intense/energetic)
- valence: 0.0 (sad/negative) to 1.0 (happy/positive)
- tempo: BPM (beats per minute)
- mood: flow (focused work), amped (high energy/workout), recovery (rest/relax), reset (balanced/flexible)
- genres: 2-4 relevant music genres
- searchQuery: A natural language query optimized for Spotify search`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const result = parseOpenAIResponse(response.data);
    return result;
  } catch (error) {
    console.error("OpenAI API Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });

    if (error.response?.status === 401) {
      const err = new Error("Invalid OpenAI API key");
      err.status = 401;
      throw err;
    }

    if (error.response?.status === 429) {
      const err = new Error("OpenAI API rate limit exceeded");
      err.status = 429;
      throw err;
    }

    throw new Error(`OpenAI API request failed: ${error.message}`);
  }
}

/**
 * Builds a structured prompt from biometric data, calendar busyness, weather, user input, and business context
 */
function buildPrompt(
  biometricData,
  calendarBusyLevel,
  weatherData,
  userInput,
  businessContext
) {
  const biometricSummary = formatBiometricData(biometricData);
  const calendarSummary = formatCalendarBusyLevel(calendarBusyLevel);
  const weatherSummary = formatWeatherData(weatherData);
  const userInputSummary = formatUserInput(userInput);
  const businessSummary = formatBusinessContext(businessContext);

  return `Analyze the following comprehensive data and recommend optimal music characteristics:

## BIOMETRIC DATA:
${biometricSummary}

## DAILY SCHEDULE BUSYNESS:
${calendarSummary}

## CURRENT WEATHER:
${weatherSummary}

## USER PREFERENCES:
${userInputSummary}

## BUSINESS/WORK CONTEXT:
${businessSummary}

Based on this holistic information, determine:
1. The person's current physiological state (energy levels, recovery needs, stress indicators)
2. Environmental factors affecting mood (weather impact, seasonal considerations)
3. Their cognitive and professional demands based on schedule busyness (high busyness = need calming/focus music, low busyness = more flexibility)
4. Personal preferences and musical taste indicators
5. Optimal music characteristics to support their wellbeing, productivity, and preferences

Consider how weather might affect mood (rainy days = cozy vibes, sunny = upbeat, cold = warming music).
Factor in business context for appropriate energy levels and focus requirements.
Consider busyness level: high busyness (80-100) suggests need for calming/focus music, medium busyness (40-79) allows moderate energy, low busyness (0-39) permits higher energy/experimental music.
Incorporate user preferences while balancing with physiological needs.

Provide your analysis as JSON.`;
}

/**
 * Formats biometric data into a readable summary
 */
function formatBiometricData(data) {
  if (!data || !data.metrics) {
    return "No biometric data available";
  }

  const { metrics, providers, sampleCount, lastUpdated } = data;
  const lines = [];

  if (providers && providers.length > 0) {
    lines.push(
      `Source: ${providers.join(", ")} (${sampleCount || 1} sample(s))`
    );
  }

  if (lastUpdated) {
    lines.push(`Last Updated: ${new Date(lastUpdated).toLocaleString()}`);
  }

  if (metrics.readiness !== null && metrics.readiness !== undefined) {
    lines.push(`- Readiness Score: ${metrics.readiness}/100`);
  }
  if (metrics.sleepQuality !== null && metrics.sleepQuality !== undefined) {
    lines.push(`- Sleep Quality: ${metrics.sleepQuality}/100`);
  }
  if (metrics.hrv !== null && metrics.hrv !== undefined) {
    lines.push(`- Heart Rate Variability (HRV): ${metrics.hrv}ms`);
  }
  if (
    metrics.restingHeartRate !== null &&
    metrics.restingHeartRate !== undefined
  ) {
    lines.push(`- Resting Heart Rate: ${metrics.restingHeartRate} bpm`);
  }
  if (metrics.strain !== null && metrics.strain !== undefined) {
    lines.push(`- Strain/Activity Level: ${metrics.strain}/21`);
  }
  if (metrics.sleepHours !== null && metrics.sleepHours !== undefined) {
    lines.push(`- Sleep Duration: ${metrics.sleepHours} hours`);
  }
  if (metrics.recovery !== null && metrics.recovery !== undefined) {
    lines.push(`- Recovery Score: ${metrics.recovery}/100`);
  }

  return lines.length > 0
    ? lines.join("\n")
    : "Limited biometric data available";
}

/**
 * Formats calendar busyness level into a readable summary
 */
function formatCalendarBusyLevel(busyLevel) {
  if (busyLevel === null || busyLevel === undefined || isNaN(busyLevel)) {
    return "No calendar busyness data provided";
  }

  const level = Math.max(0, Math.min(100, Number(busyLevel))); // Clamp between 0-100

  let description;
  if (level >= 90) {
    description =
      "Extremely busy - packed schedule with back-to-back commitments";
  } else if (level >= 70) {
    description = "Very busy - high meeting load and deadlines";
  } else if (level >= 50) {
    description = "Moderately busy - balanced workload";
  } else if (level >= 30) {
    description = "Lightly scheduled - some meetings but manageable";
  } else if (level >= 10) {
    description = "Minimal commitments - mostly free time";
  } else {
    description = "Very light schedule - lots of free time available";
  }

  return `Busyness Level: ${level}/100 (${description})`;
}

/**
 * Formats weather data into a readable summary
 */
function formatWeatherData(weatherData) {
  if (!weatherData) {
    return "No weather data available";
  }

  const lines = [];

  if (weatherData.location) {
    lines.push(`Location: ${weatherData.location}`);
  }

  if (weatherData.temperature !== undefined) {
    lines.push(`Temperature: ${weatherData.temperature}°F`);
  }

  if (weatherData.condition) {
    lines.push(`Condition: ${weatherData.condition}`);
  }

  if (weatherData.description) {
    lines.push(`Description: ${weatherData.description}`);
  }

  if (weatherData.isRaining !== undefined) {
    lines.push(
      `Precipitation: ${weatherData.isRaining ? "Yes (raining)" : "None"}`
    );
  }

  if (weatherData.isOvercast !== undefined) {
    lines.push(
      `Sky: ${
        weatherData.isOvercast ? "Overcast/Cloudy" : "Clear/Partly cloudy"
      }`
    );
  }

  if (weatherData.humidity !== undefined) {
    lines.push(`Humidity: ${weatherData.humidity}%`);
  }

  if (weatherData.windSpeed !== undefined) {
    lines.push(`Wind: ${weatherData.windSpeed} mph`);
  }

  return lines.length > 0 ? lines.join("\n") : "Limited weather data available";
}

/**
 * Formats user input/preferences into a readable summary
 */
function formatUserInput(userInput) {
  if (!userInput || userInput.trim() === "") {
    return "No specific user preferences provided";
  }

  return `User says: "${userInput.trim()}"`;
}

/**
 * Formats business/work context into a readable summary
 */
function formatBusinessContext(businessContext) {
  if (!businessContext) {
    return "No business context provided";
  }

  const lines = [];

  if (businessContext.workMode) {
    lines.push(`Work Mode: ${businessContext.workMode}`);
  }

  if (businessContext.environment) {
    lines.push(`Environment: ${businessContext.environment}`);
  }

  if (businessContext.deadline) {
    lines.push(`Deadline Pressure: ${businessContext.deadline}`);
  }

  if (businessContext.teamSize) {
    lines.push(`Team Context: ${businessContext.teamSize}`);
  }

  if (businessContext.meetingLoad) {
    lines.push(`Meeting Load: ${businessContext.meetingLoad}`);
  }

  if (businessContext.focusTime) {
    lines.push(`Focus Time Available: ${businessContext.focusTime}`);
  }

  if (businessContext.industry) {
    lines.push(`Industry: ${businessContext.industry}`);
  }

  return lines.length > 0
    ? lines.join("\n")
    : "Limited business context available";
}

/**
 * Formats time from various input formats
 */
function formatTime(timeInput) {
  try {
    const date = new Date(timeInput);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return timeInput.toString();
  }
}
function formatTime(timeInput) {
  try {
    const date = new Date(timeInput);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return timeInput.toString();
  }
}

/**
 * Parses and validates OpenAI response
 */
function parseOpenAIResponse(data) {
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No content in OpenAI response");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error("Failed to parse OpenAI response:", content);
    throw new Error("Invalid JSON response from OpenAI");
  }

  // Validate and set defaults
  const result = {
    mood: validateMood(parsed.mood),
    energy: clampValue(parsed.energy, 0, 1, 0.5),
    valence: clampValue(parsed.valence, 0, 1, 0.5),
    tempo: clampValue(parsed.tempo, 60, 200, 100),
    genres: Array.isArray(parsed.genres) ? parsed.genres.slice(0, 4) : [],
    searchQuery: parsed.searchQuery || "",
    reasoning: parsed.reasoning || "No reasoning provided",
  };

  return result;
}

/**
 * Validates mood label
 */
function validateMood(mood) {
  const validMoods = ["flow", "amped", "recovery", "reset"];
  return validMoods.includes(mood) ? mood : "reset";
}

/**
 * Clamps a numeric value between min and max
 */
function clampValue(value, min, max, defaultValue) {
  const num = parseFloat(value);
  if (isNaN(num)) return defaultValue;
  return Math.max(min, Math.min(max, num));
}

/**
 * Generates a Spotify search query from OpenAI recommendations
 * Can be used as a fallback or to enhance the search
 */
function generateSpotifySearchQuery(aiParams) {
  const { mood, genres, energy, valence } = aiParams;

  // Build query based on recommendations
  const parts = [];

  if (genres && genres.length > 0) {
    parts.push(genres.slice(0, 2).join(" "));
  }

  // Add mood descriptors
  const moodDescriptors = {
    flow: "focus deep work",
    amped: "high energy workout",
    recovery: "calm relaxing",
    reset: "uplifting feel good",
  };

  parts.push(moodDescriptors[mood] || "chill");

  // Add energy/valence hints
  if (energy > 0.7) {
    parts.push("upbeat");
  } else if (energy < 0.4) {
    parts.push("mellow");
  }

  if (valence > 0.7) {
    parts.push("happy");
  }

  return parts.join(" ");
}

module.exports = {
  analyzeAndGeneratePlaylistParams,
  generateSpotifySearchQuery,
  formatBiometricData,
  formatCalendarBusyLevel,
  formatWeatherData,
  formatUserInput,
  formatBusinessContext,
};
