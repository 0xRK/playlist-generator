const axios = require('axios');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Analyzes biometric data and calendar events using OpenAI to generate
 * personalized Spotify playlist parameters.
 * 
 * @param {Object} biometricData - Wearable device data (HRV, sleep, strain, etc.)
 * @param {Array} calendarEvents - Daily calendar events
 * @param {}
 * @returns {Promise<Object>} Playlist parameters for Spotify
 */
async function analyzeAndGeneratePlaylistParams(biometricData, calendarEvents = [], weatherData, userMoodPreference = '') {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured in environment variables');
  }

  const prompt = buildPrompt(biometricData, calendarEvents, weatherData, userMoodPreference);

  console.log('--- OpenAI Prompt ---');
  console.log(prompt);
  console.log('---------------------');

  try {
    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-4o-mini', // Using gpt-4o-mini for cost efficiency, can upgrade to gpt-4o for better results
        messages: [
          {
            role: 'system',
            content: `You are an expert music therapist and data analyst. Your role is to analyze biometric data, daily schedules, weather, and the user's stated music preference to recommend optimal music characteristics that will enhance productivity, mood, and wellbeing.

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
- searchQuery: A natural language query optimized for Spotify search
- If the user explicitly states a desired mood or effect (e.g. "calm me down", "get me hyped"), this should strongly guide your choices as long as it is not in direct conflict with clear physiological needs (e.g. extremely low readiness + request for max intensity).`

          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" }
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = parseOpenAIResponse(response.data);

    console.log('--- OpenAI Response ---');
    console.log(JSON.stringify(result, null, 2));
    console.log('-----------------------');

    return result;

  } catch (error) {
    console.error('OpenAI API Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response?.status === 401) {
      const err = new Error('Invalid OpenAI API key');
      err.status = 401;
      throw err;
    }

    if (error.response?.status === 429) {
      const err = new Error('OpenAI API rate limit exceeded');
      err.status = 429;
      throw err;
    }

    throw new Error(`OpenAI API request failed: ${error.message}`);
  }
}

/**
 * Builds a structured prompt from biometric data and calendar events
 */
function buildPrompt(biometricData, calendarEvents, weatherData, userMoodPreference) {
  const biometricSummary = formatBiometricData(biometricData);
  const calendarSummary = formatCalendarEvents(calendarEvents);
  const weatherSummary = formatWeatherData(weatherData);

  return `Analyze the following data and recommend optimal music characteristics:

## BIOMETRIC DATA:
${biometricSummary}

## DAILY SCHEDULE:
${calendarSummary}

## UPCOMING WEATHER:
${weatherSummary}

## USER'S DESIRED MOOD / EFFECT FROM MUSIC:
${userMoodPreference || 'Not specified'}

Based on this information, determine:
1. The person's current physiological state (energy levels, recovery needs)
2. Their cognitive demands for the day (focus work, meetings, exercise)
3. How weather might impact their mood and energy
4. Optimal music characteristics to support their wellbeing and productivity

Provide your analysis as JSON.`;
}

/**
 * Formats biometric data into a readable summary
 */
function formatBiometricData(data) {
  if (!data || !data.metrics) {
    return 'No biometric data available';
  }

  const { metrics, providers, sampleCount, lastUpdated } = data;
  const lines = [];

  if (providers && providers.length > 0) {
    lines.push(`Source: ${providers.join(', ')} (${sampleCount || 1} sample(s))`);
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
  if (metrics.restingHeartRate !== null && metrics.restingHeartRate !== undefined) {
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

  return lines.length > 0 ? lines.join('\n') : 'Limited biometric data available';
}

/**
 * Formats calendar events into a readable summary
 */
function formatCalendarEvents(events) {
  if (!events || events.length === 0) {
    return 'No calendar events provided';
  }

  const lines = ['Today\'s Schedule:'];

  events.forEach((event, index) => {
    const time = event.start ? formatTime(event.start) : 'Time TBD';
    const title = event.title || event.summary || 'Untitled Event';
    const duration = event.duration ? ` (${event.duration} min)` : '';
    const type = event.type ? ` [${event.type}]` : '';

    lines.push(`${index + 1}. ${time} - ${title}${duration}${type}`);
  });

  return lines.join('\n');
}

function formatWeatherData(weather) {
  if (!weather || Object.keys(weather).length === 0) {
    return 'No weather data available';
  }

  const lines = [];

  // Example fields — ALL STRINGS as you requested
  if (weather.condition) lines.push(`- Condition: ${weather.condition}`);
  if (weather.temperature) lines.push(`- Temperature: ${weather.temperature}`);
  if (weather.wind) lines.push(`- Wind: ${weather.wind}`);
  if (weather.humidity) lines.push(`- Humidity: ${weather.humidity}`);
  if (weather.precipitation) lines.push(`- Precipitation: ${weather.precipitation}`);
  if (weather.sunrise) lines.push(`- Sunrise: ${weather.sunrise}`);
  if (weather.sunset) lines.push(`- Sunset: ${weather.sunset}`);

  return lines.join('\n');
}

/**
 * Formats time from various input formats
 */
function formatTime(timeInput) {
  try {
    const date = new Date(timeInput);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
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
    throw new Error('No content in OpenAI response');
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    console.error('Failed to parse OpenAI response:', content);
    throw new Error('Invalid JSON response from OpenAI');
  }

  // Validate and set defaults
  const result = {
    mood: validateMood(parsed.mood),
    energy: clampValue(parsed.energy, 0, 1, 0.5),
    valence: clampValue(parsed.valence, 0, 1, 0.5),
    tempo: clampValue(parsed.tempo, 60, 200, 100),
    genres: Array.isArray(parsed.genres) ? parsed.genres.slice(0, 4) : [],
    searchQuery: parsed.searchQuery || '',
    reasoning: parsed.reasoning || 'No reasoning provided'
  };

  return result;
}

/**
 * Validates mood label
 */
function validateMood(mood) {
  const validMoods = ['flow', 'amped', 'recovery', 'reset'];
  return validMoods.includes(mood) ? mood : 'reset';
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
    parts.push(genres.slice(0, 2).join(' '));
  }

  // Add mood descriptors
  const moodDescriptors = {
    flow: 'focus deep work',
    amped: 'high energy workout',
    recovery: 'calm relaxing',
    reset: 'uplifting feel good'
  };

  parts.push(moodDescriptors[mood] || 'chill');

  // Add energy/valence hints
  if (energy > 0.7) {
    parts.push('upbeat');
  } else if (energy < 0.4) {
    parts.push('mellow');
  }

  if (valence > 0.7) {
    parts.push('happy');
  }

  return parts.join(' ');
}

module.exports = {
  analyzeAndGeneratePlaylistParams,
  generateSpotifySearchQuery,
  formatBiometricData,
  formatCalendarEvents
};

