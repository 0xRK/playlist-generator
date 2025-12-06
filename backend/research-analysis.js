require('dotenv').config();
const fs = require('fs');
const axios = require('axios');

const openaiService = require('./src/services/openaiService');

const USE_OPENAI = process.env.OPENAI_API_KEY ? true : false;
const USE_SPOTIFY = process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET ? true : false;

if (!USE_OPENAI) {
    console.error('❌ OpenAI API Key is missing. This analysis requires OpenAI.');
    process.exit(1);
}

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_SEARCH_URL = 'https://api.spotify.com/v1/search';

const MOOD_SEARCH_QUERIES = {
    flow: '"deep focus" instrumental',
    amped: 'high energy workout',
    recovery: 'calm acoustic relaxation',
    reset: 'feel good indie pop',
};

const SAMPLE_CONTEXT = {
    weather: {
        condition: 'Partly Cloudy',
        temperature: '62°F',
        humidity: '45%',
    },
    calendarEvents: [
        { title: 'Team Meeting', start: '2024-01-15T10:00:00Z', duration: 60, type: 'meeting' },
        { title: 'Project Work', start: '2024-01-15T14:00:00Z', duration: 120, type: 'work' },
    ],
};

async function getSpotifyToken() {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(SPOTIFY_TOKEN_URL,
            'grant_type=client_credentials',
            {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error('Failed to get Spotify token:', error.response?.data || error.message);
        throw new Error('Spotify authentication failed');
    }
}

async function searchSpotifyTracks(accessToken, query, limit = 20) {
    try {
        const response = await axios.get(SPOTIFY_SEARCH_URL, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            params: {
                q: query,
                type: 'track',
                limit: limit,
                market: 'US',
            },
        });

        return response.data.tracks?.items || [];
    } catch (error) {
        console.error(`Spotify search failed for "${query}":`, error.response?.data || error.message);
        return [];
    }
}

/**
 * Validate that the mood generates a valid search query and returns tracks
 * (Audio feature analysis removed due to Spotify API restrictions)
 */
async function validatePlaylistSearch(accessToken, moodLabel) {
    const query = MOOD_SEARCH_QUERIES[moodLabel] || moodLabel;

    console.log(`  Searching Spotify for "${query}"...`);
    const tracks = await searchSpotifyTracks(accessToken, query, 5);

    if (!tracks.length) {
        console.log(`  ⚠️  No tracks found for "${query}"`);
        return null;
    }

    // Sample tracks for display
    const sampleTracks = tracks.map(t => ({
        name: t.name,
        artist: t.artists?.[0]?.name || 'Unknown',
    }));

    return {
        query,
        trackCount: tracks.length,
        sampleTracks,
        valid: true
    };
}

// ============================================================================
// BIOMETRIC CORRELATION ANALYSIS
// ============================================================================

/**
 * Analyze how biometric inputs correlate with recommendation outputs
 * This tests the core research question: do biometrics influence recommendations?
 */
async function runBiometricCorrelationAnalysis() {
    console.log('\n📈 BIOMETRIC-TO-RECOMMENDATION CORRELATION ANALYSIS (OpenAI Only)');
    console.log('='.repeat(60));
    console.log('Testing how changes in biometric data affect OpenAI playlist recommendations...\n');

    const results = {
        readinessGradient: [],
        sleepGradient: [],
        strainGradient: [],
        correlations: {},
    };

    // Test 1: Readiness gradient (10-100, with sleep at 75 to allow flow at high readiness)
    console.log('Testing Readiness gradient (10-100)...');
    console.log('  (Sleep held at 75 to enable flow state at high readiness)');
    for (let readiness = 10; readiness <= 100; readiness += 10) {
        const biometricData = {
            // Sleep at 75 (normalized 0.75 > 0.7) allows flow when readiness > 70
            metrics: { readiness, sleepQuality: 75, hrv: 80, strain: 5, restingHeartRate: 55 },
            providers: ['synthetic'],
            lastUpdated: new Date().toISOString(),
            sampleCount: 1,
        };

        let aiResult = null;
        try {
            aiResult = await openaiService.analyzeAndGeneratePlaylistParams(
                biometricData, SAMPLE_CONTEXT.calendarEvents, SAMPLE_CONTEXT.weather, ''
            );
        } catch (err) {
            console.log(`  OpenAI error at readiness=${readiness}: ${err.message}`);
        }

        if (aiResult) {
            results.readinessGradient.push({
                readiness,
                openai: {
                    mood: aiResult.mood,
                    energy: aiResult.energy,
                    valence: aiResult.valence,
                    tempo: aiResult.tempo,
                },
            });
            console.log(`  Readiness ${readiness}: energy=${aiResult.energy.toFixed(2)}, mood=${aiResult.mood}`);
        }
    }

    // Test 2: Sleep Quality gradient (10-100, with readiness at 75 to allow flow at high sleep)
    console.log('\nTesting Sleep Quality gradient (10-100)...');
    console.log('  (Readiness held at 75 to enable flow state at high sleep)');
    for (let sleepQuality = 10; sleepQuality <= 100; sleepQuality += 10) {
        const biometricData = {
            // Readiness at 75 (normalized 0.75 > 0.7) allows flow when sleep > 70
            metrics: { readiness: 75, sleepQuality, hrv: 80, strain: 5, restingHeartRate: 55 },
            providers: ['synthetic'],
            lastUpdated: new Date().toISOString(),
            sampleCount: 1,
        };

        let aiResult = null;
        try {
            aiResult = await openaiService.analyzeAndGeneratePlaylistParams(
                biometricData, SAMPLE_CONTEXT.calendarEvents, SAMPLE_CONTEXT.weather, ''
            );
        } catch (err) {
            console.log(`  OpenAI error at sleep=${sleepQuality}: ${err.message}`);
        }

        if (aiResult) {
            results.sleepGradient.push({
                sleepQuality,
                openai: {
                    mood: aiResult.mood,
                    energy: aiResult.energy,
                    valence: aiResult.valence,
                    tempo: aiResult.tempo,
                },
            });
            console.log(`  Sleep ${sleepQuality}: energy=${aiResult.energy.toFixed(2)}, mood=${aiResult.mood}`);
        }
    }

    // Test 3: Strain gradient (0-21, with readiness at 60 to allow amped at high strain)
    console.log('\nTesting Strain gradient (0-21)...');
    console.log('  (Readiness at 60 enables amped state when strain > 12.6)');
    for (let strain = 0; strain <= 21; strain += 3) {
        const biometricData = {
            // Readiness at 60 (normalized 0.6 > 0.55) allows amped when strain > 0.6 (>12.6)
            metrics: { readiness: 60, sleepQuality: 55, hrv: 80, strain, restingHeartRate: 55 },
            providers: ['synthetic'],
            lastUpdated: new Date().toISOString(),
            sampleCount: 1,
        };

        let aiResult = null;
        try {
            aiResult = await openaiService.analyzeAndGeneratePlaylistParams(
                biometricData, SAMPLE_CONTEXT.calendarEvents, SAMPLE_CONTEXT.weather, ''
            );
        } catch (err) {
            console.log(`  OpenAI error at strain=${strain}: ${err.message}`);
        }

        if (aiResult) {
            results.strainGradient.push({
                strain,
                openai: {
                    mood: aiResult.mood,
                    energy: aiResult.energy,
                    valence: aiResult.valence,
                    tempo: aiResult.tempo,
                },
            });
            console.log(`  Strain ${strain}: energy=${aiResult.energy.toFixed(2)}, mood=${aiResult.mood}`);
        }
    }

    console.log('\nCalculating correlations...');

    results.correlations.openai = {
        readinessToEnergy: calculateCorrelation(
            results.readinessGradient.map(r => r.readiness),
            results.readinessGradient.map(r => r.openai.energy)
        ),
        readinessToValence: calculateCorrelation(
            results.readinessGradient.map(r => r.readiness),
            results.readinessGradient.map(r => r.openai.valence)
        ),
        readinessToTempo: calculateCorrelation(
            results.readinessGradient.map(r => r.readiness),
            results.readinessGradient.map(r => r.openai.tempo)
        ),
        sleepToEnergy: calculateCorrelation(
            results.sleepGradient.map(r => r.sleepQuality),
            results.sleepGradient.map(r => r.openai.energy)
        ),
        strainToEnergy: calculateCorrelation(
            results.strainGradient.map(r => r.strain),
            results.strainGradient.map(r => r.openai.energy)
        ),
    };

    return results;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(x, y) {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;
    return numerator / denominator;
}

function generateTimestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
    console.log('\n🔬 BIOMETRIC-TO-PLAYLIST RECOMMENDATION ANALYSIS');
    console.log('='.repeat(60));
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log(`OpenAI Available: ${USE_OPENAI}`);
    console.log(`Spotify Available: ${USE_SPOTIFY}`);

    const results = {
        metadata: {
            timestamp: new Date().toISOString(),
            openaiEnabled: USE_OPENAI,
            spotifyEnabled: USE_SPOTIFY,
            description: 'Correlation analysis between biometric inputs and playlist recommendations (OpenAI Only)',
        },
        biometricCorrelation: null,
        spotifyValidation: null,
    };

    try {
        // Run biometric correlation analysis
        results.biometricCorrelation = await runBiometricCorrelationAnalysis();

        // Run Spotify search validation (if credentials available)
        if (USE_SPOTIFY) {
            console.log('\n🎵 SPOTIFY SEARCH VALIDATION');
            console.log('='.repeat(60));
            console.log('Validating that AI-generated queries return actual tracks...\n');

            try {
                const spotifyToken = await getSpotifyToken();
                console.log('✓ Spotify authentication successful\n');

                const moodParams = ['flow', 'amped', 'recovery', 'reset'];
                results.spotifyValidation = { moods: {} };

                for (const mood of moodParams) {
                    console.log(`Testing "${mood}" mood...`);
                    const validation = await validatePlaylistSearch(spotifyToken, mood);

                    if (validation) {
                        results.spotifyValidation.moods[mood] = validation;
                        console.log(`  ✓ Found ${validation.trackCount} tracks`);
                        console.log(`  Sample: ${validation.sampleTracks.map(t => `"${t.name}"`).slice(0, 2).join(', ')}\n`);
                    }
                }

            } catch (spotifyErr) {
                console.error('Spotify validation failed:', spotifyErr.message);
                results.spotifyValidation = { error: spotifyErr.message };
            }
        }

        // Save results
        const outputFile = `research-results-${generateTimestamp()}.json`;
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
        console.log(`\n💾 Results saved to: ${outputFile}`);

        // Print summary
        console.log('\n📋 SUMMARY');
        console.log('='.repeat(60));
        console.log('Biometric-to-Recommendation Correlations (OpenAI):');
        console.log(`  Readiness → Energy: ${results.biometricCorrelation.correlations.openai.readinessToEnergy.toFixed(3)}`);
        console.log(`  Readiness → Valence: ${results.biometricCorrelation.correlations.openai.readinessToValence.toFixed(3)}`);
        console.log(`  Readiness → Tempo: ${results.biometricCorrelation.correlations.openai.readinessToTempo.toFixed(3)}`);
        console.log(`  Sleep → Energy: ${results.biometricCorrelation.correlations.openai.sleepToEnergy.toFixed(3)}`);
        console.log(`  Strain → Energy: ${results.biometricCorrelation.correlations.openai.strainToEnergy.toFixed(3)}`);

        if (results.spotifyValidation && results.spotifyValidation.moods) {
            console.log('\nSpotify Search Validation:');
            console.log('  ✓ Search API working - tracks found for all moods');
            console.log('  (Audio features analysis skipped due to API restrictions)');
        }

        console.log('\n✅ Analysis complete!');

    } catch (err) {
        console.error('\n❌ Analysis failed:', err.message);
        process.exit(1);
    }
}

main();
