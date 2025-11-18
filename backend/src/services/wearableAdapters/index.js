const normalizeWhoopPayload = require('./whoopAdapter');
const normalizeOuraPayload = require('./ouraAdapter');

const adapters = {
  whoop: normalizeWhoopPayload,
  oura: normalizeOuraPayload,
};

function normalize(provider, payload) {
  const adapter = adapters[provider];

  if (!adapter) {
    const error = new Error(`Unsupported provider: ${provider}`);
    error.status = 400;
    throw error;
  }

  return adapter(payload);
}

module.exports = {
  adapters: Object.keys(adapters),
  normalize,
};

