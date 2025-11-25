/**
 * Example script demonstrating how to use the OpenAI playlist generation service
 * 
 * Usage: node examples/aiPlaylistExample.js
 */

const openaiService = require('../src/services/openaiService');

// Example biometric data (from Oura Ring, Whoop, etc.)
const exampleBiometricData = {
  metrics: {
    readiness: 85,
    sleepQuality: 78,
    hrv: 65,
    restingHeartRate: 58,
    strain: 12.5,
    sleepHours: 7.5
  },
  providers: ['oura'],
  sampleCount: 1,
  lastUpdated: new Date().toISOString()
};

// Example calendar events for the day
const exampleCalendarEvents = [
  {
    title: 'Morning Standup',
    start: '2024-01-15T09:00:00Z',
    duration: 15,
    type: 'meeting'
  },
  {
    title: 'Deep Work: Feature Development',
    start: '2024-01-15T09:30:00Z',
    duration: 120,
    type: 'focus'
  },
  {
    title: 'Lunch Break',
    start: '2024-01-15T12:00:00Z',
    duration: 60,
    type: 'break'
  },
  {
    title: 'Team Sync',
    start: '2024-01-15T14:00:00Z',
    duration: 30,
    type: 'meeting'
  },
  {
    title: 'Gym Workout',
    start: '2024-01-15T17:00:00Z',
    duration: 60,
    type: 'exercise'
  }
];

async function runExample() {
  console.log('='.repeat(60));
  console.log('OpenAI Playlist Generation Example');
  console.log('='.repeat(60));
  console.log();

  // Display the input data
  console.log('📊 BIOMETRIC DATA:');
  console.log(openaiService.formatBiometricData(exampleBiometricData));
  console.log();

  console.log('📅 CALENDAR EVENTS:');
  console.log(openaiService.formatCalendarBusyLevel(exampleCalendarEvents));
  console.log();

  console.log('🤖 Analyzing with OpenAI...');
  console.log();

  try {
    // Generate AI recommendations
    const recommendations = await openaiService.analyzeAndGeneratePlaylistParams(
      exampleBiometricData,
      exampleCalendarEvents
    );

    console.log('✅ AI RECOMMENDATIONS:');
    console.log(JSON.stringify(recommendations, null, 2));
    console.log();

    console.log('🎵 SPOTIFY SEARCH QUERY:');
    console.log(`  "${recommendations.searchQuery}"`);
    console.log();

    console.log('💡 AI REASONING:');
    console.log(`  ${recommendations.reasoning}`);
    console.log();

    // Generate alternative Spotify query
    const altQuery = openaiService.generateSpotifySearchQuery(recommendations);
    console.log('🔄 ALTERNATIVE SEARCH QUERY:');
    console.log(`  "${altQuery}"`);
    console.log();

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.log();

    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('💡 SETUP REQUIRED:');
      console.log('  1. Get an API key from: https://platform.openai.com/api-keys');
      console.log('  2. Add it to your .env file: OPENAI_API_KEY=sk-...');
      console.log('  3. Restart the server');
    }
  }

  console.log('='.repeat(60));
}

// Run the example
runExample();

