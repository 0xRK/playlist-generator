const wearableData = {};
let moodSnapshot = null;
let contextData = {
  weather: null,
  scheduleLoad: null,
  userInput: null,
};

function averageMetric(entries, key) {
  const values = entries
    .map(entry => entry.metrics?.[key])
    .filter(value => typeof value === 'number' && !Number.isNaN(value));

  if (!values.length) {
    return null;
  }

  const sum = values.reduce((total, value) => total + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function setWearableData(provider, normalizedPayload) {
  wearableData[provider] = normalizedPayload;
}

function getWearableData() {
  return wearableData;
}

function getAggregatedMetrics() {
  const entries = Object.values(wearableData);

  if (!entries.length) {
    return null;
  }

  const aggregated = {
    sampleCount: entries.length,
    providers: entries.map(entry => entry.provider),
    lastUpdated: new Date().toISOString(),
    metrics: {
      hrv: averageMetric(entries, 'hrv'),
      sleepQuality: averageMetric(entries, 'sleepQuality'),
      strain: averageMetric(entries, 'strain'),
      readiness: averageMetric(entries, 'readiness'),
      restingHeartRate: averageMetric(entries, 'restingHeartRate'),
    },
  };

  return aggregated;
}

function setMoodSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  moodSnapshot = {
    ...snapshot,
    updatedAt: new Date().toISOString(),
  };
}

function getMoodSnapshot() {
  return moodSnapshot;
}

/**
 * Store contextual data (weather, schedule load, user input) for use in playlist generation.
 * Only updates fields that are explicitly provided (undefined values are ignored).
 * @param {Object} context - Context data object
 * @param {Object} [context.weather] - Current weather data
 * @param {number} [context.scheduleLoad] - Schedule busyness level (0.0-1.0)
 * @param {string} [context.userInput] - User's custom mood/music preference
 */
function setContextData({ weather, scheduleLoad, userInput }) {
  if (weather !== undefined) contextData.weather = weather;
  if (scheduleLoad !== undefined) contextData.scheduleLoad = scheduleLoad;
  if (userInput !== undefined) contextData.userInput = userInput;
}

/**
 * Retrieve stored contextual data for playlist generation.
 * @returns {Object} Context data containing weather, scheduleLoad, and userInput
 */
function getContextData() {
  return contextData;
}

function reset() {
  Object.keys(wearableData).forEach(key => delete wearableData[key]);
  moodSnapshot = null;
  contextData = {
    weather: null,
    scheduleLoad: null,
    userInput: null,
  };
}

module.exports = {
  setWearableData,
  getWearableData,
  getAggregatedMetrics,
  setMoodSnapshot,
  getMoodSnapshot,
  setContextData,
  getContextData,
  reset,
};

