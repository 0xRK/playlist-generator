const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const wearableRoutes = require('./routes/wearableRoutes');
const moodRoutes = require('./routes/moodRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const aiPlaylistRoutes = require('./routes/aiPlaylistRoutes');

function buildCorsConfig() {
  const origins = process.env.CLIENT_URL
    ? process.env.CLIENT_URL.split(',').map(origin => origin.trim()).filter(Boolean)
    : [];

  if (!origins.length) {
    return { origin: true, credentials: true };
  }

  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  };
}

function createApp() {
  const app = express();

  app.use(cors(buildCorsConfig()));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', updatedAt: new Date().toISOString() });
  });

  app.use('/auth', authRoutes);
  app.use('/api/wearables', wearableRoutes);
  app.use('/api/mood', moodRoutes);
  app.use('/api/playlists', playlistRoutes);
  app.use('/api/ai-playlists', aiPlaylistRoutes);

  // Simple error handler to keep responses consistent for the skeleton.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({
      message: err.message || 'Unexpected server error',
      status,
    });
  });

  return app;
}

module.exports = createApp;

