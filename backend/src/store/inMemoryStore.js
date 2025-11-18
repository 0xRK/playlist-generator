const wearableData = {};
let moodSnapshot = null;

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

function reset() {
  Object.keys(wearableData).forEach(key => delete wearableData[key]);
  moodSnapshot = null;
}

module.exports = {
  setWearableData,
  getWearableData,
  getAggregatedMetrics,
  setMoodSnapshot,
  getMoodSnapshot,
  reset,
};

