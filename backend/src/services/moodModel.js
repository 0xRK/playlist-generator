function clamp(value, min = 0, max = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  return Math.min(Math.max(value, min), max);
}

function normalize(value, min, max) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const normalized = (value - min) / (max - min);
  return clamp(Number(normalized.toFixed(2)));
}

function buildFeatureVector(metrics = {}) {
  return {
    readinessScore: normalize(metrics.readiness, 0, 100) ?? 0.5,
    recoveryScore: normalize(metrics.hrv, 20, 150) ?? 0.5,
    sleepScore: normalize(metrics.sleepQuality, 0, 100) ?? 0.5,
    strainScore: normalize(metrics.strain, 0, 21) ?? 0.3,
    restingHrScore: normalize(metrics.restingHeartRate ? 80 - metrics.restingHeartRate : null, -10, 50) ?? 0.5,
  };
}

const MOOD_LABELS = [
  {
    label: 'flow',
    condition: features => features.readinessScore > 0.7 && features.sleepScore > 0.7,
    summary: 'Balanced recovery + sleep, ready for focused deep work.',
    playlistHints: { targetEnergy: 0.65, targetValence: 0.55, targetTempo: 110 },
    recommendations: ['Lean into deep focus work blocks', 'Keep energy steady with mid-tempo playlists'],
  },
  {
    label: 'amped',
    condition: features => features.strainScore > 0.6 && features.readinessScore > 0.55,
    summary: 'High physiological activation — great for workouts or shipping sprints.',
    playlistHints: { targetEnergy: 0.85, targetValence: 0.6, targetTempo: 130 },
    recommendations: ['Channel intensity toward creative output', 'Favor upbeat tracks to ride the momentum'],
  },
  {
    label: 'recovery',
    condition: features => features.readinessScore < 0.45 || features.sleepScore < 0.45,
    summary: 'Body is signaling fatigue — keep things calm and restorative.',
    playlistHints: { targetEnergy: 0.35, targetValence: 0.5, targetTempo: 80 },
    recommendations: ['Prioritize low-pressure tasks', 'Use downtempo playlists to reduce stress'],
  },
  {
    label: 'reset',
    condition: () => true,
    summary: 'Mixed signals — treat today as a reset and stay flexible.',
    playlistHints: { targetEnergy: 0.5, targetValence: 0.55, targetTempo: 100 },
    recommendations: ['Alternate between focus + recovery blocks', 'Use versatile playlists that adapt with you'],
  },
];

function computeMood(features) {
  const weightedScore = Number(
    (
      features.readinessScore * 0.25 +
      features.sleepScore * 0.2 +
      features.recoveryScore * 0.2 +
      features.restingHrScore * 0.15 -
      features.strainScore * 0.15
    ).toFixed(2),
  );

  const selected = MOOD_LABELS.find(config => config.condition(features));

  return {
    label: selected.label,
    score: weightedScore,
    summary: selected.summary,
    playlistHints: selected.playlistHints,
    recommendations: selected.recommendations,
    featureVector: features,
  };
}

function inferMood(aggregatedMetrics) {
  if (!aggregatedMetrics) {
    const error = new Error('No wearable data has been ingested yet.');
    error.status = 400;
    throw error;
  }

  const features = buildFeatureVector(aggregatedMetrics.metrics);
  return computeMood(features);
}

module.exports = {
  inferMood,
};

