function normalizeOuraPayload(payload = {}) {
  const readiness = payload.readiness || {};
  const sleep = payload.sleep || payload.sleep_summary || {};

  return {
    provider: 'oura',
    timestamp: payload.timestamp || readiness.timestamp || new Date().toISOString(),
    metrics: {
      hrv: Number(readiness.hrv_balance) || null,
      sleepQuality: Number(sleep.score) || null,
      strain: Number(payload.activity?.strain || payload.activity?.score) || null,
      readiness: Number(readiness.score) || null,
      restingHeartRate: Number(sleep.resting_heart_rate || readiness.resting_heart_rate) || null,
    },
    raw: payload,
  };
}

module.exports = normalizeOuraPayload;

