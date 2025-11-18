function normalizeWhoopPayload(payload = {}) {
  const recovery = payload.recovery || {};
  const sleep = payload.sleep || {};

  return {
    provider: 'whoop',
    timestamp: payload.timestamp || recovery.timestamp || new Date().toISOString(),
    metrics: {
      hrv: Number(recovery.hrv ?? recovery.heart_rate_variability) || null,
      sleepQuality: Number(sleep.score ?? sleep.quality_score) || null,
      strain: Number(payload.strain ?? payload.training_load?.strain) || null,
      readiness: Number(recovery.score ?? recovery.readiness_score) || null,
      restingHeartRate: Number(recovery.resting_heart_rate) || null,
    },
    raw: payload,
  };
}

module.exports = normalizeWhoopPayload;

