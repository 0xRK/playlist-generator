const request = require('supertest');
const express = require('express');
const aiPlaylistRoutes = require('../src/routes/aiPlaylistRoutes');
const openaiService = require('../src/services/openaiService');
const spotifyService = require('../src/services/spotifyService');
const { getAggregatedMetrics } = require('../src/store/inMemoryStore');

jest.mock('../src/services/openaiService');
jest.mock('../src/services/spotifyService');
jest.mock('../src/store/inMemoryStore');

const app = express();
app.use(express.json());
app.use('/api/ai-playlists', aiPlaylistRoutes);

describe('AI Playlist Routes', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST /api/ai-playlists should return analysis and tracks', async () => {
        getAggregatedMetrics.mockReturnValue({
            metrics: { readiness: 80 },
            providers: ['Whoop'],
            lastUpdated: new Date().toISOString(),
            sampleCount: 1
        });

        openaiService.analyzeAndGeneratePlaylistParams.mockResolvedValue({
            mood: 'flow',
            searchQuery: 'focus music',
            genres: ['ambient']
        });

        spotifyService.fetchLiveTracks.mockResolvedValue({
            tracks: [{ id: '1', name: 'Track 1' }],
            source: 'spotify'
        });

        const res = await request(app)
            .post('/api/ai-playlists')
            .send({ accessToken: 'valid-token' });

        expect(res.status).toBe(200);
        expect(res.body.aiAnalysis.mood).toBe('flow');
        expect(res.body.tracks).toHaveLength(1);
        expect(res.body.source).toBe('spotify');
    });

    test('POST /api/ai-playlists should use fallback if no token', async () => {
        getAggregatedMetrics.mockReturnValue({
            metrics: { readiness: 80 },
            providers: ['Whoop'],
            lastUpdated: new Date().toISOString(),
            sampleCount: 1
        });

        openaiService.analyzeAndGeneratePlaylistParams.mockResolvedValue({
            mood: 'flow'
        });

        spotifyService.getFallbackTracks.mockReturnValue([
            { id: 'fallback1', name: 'Fallback Track' }
        ]);

        const res = await request(app)
            .post('/api/ai-playlists')
            .send({}); // No token

        expect(res.status).toBe(200);
        expect(res.body.source).toBe('fallback-no-token');
        expect(res.body.tracks).toHaveLength(1);
    });

    test('POST /api/ai-playlists should return 400 if no biometrics', async () => {
        getAggregatedMetrics.mockReturnValue(null);

        const res = await request(app)
            .post('/api/ai-playlists')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/No biometric data/);
    });
});
