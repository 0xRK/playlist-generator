#!/usr/bin/env node
/**
 * Test script to verify OpenAI integration in openaiService.js
 * 
 * Usage:
 *   node backend/test-openai-integration.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { analyzeAndGeneratePlaylistParams } = require('./src/services/openaiService');

console.log('🧪 Testing OpenAI Integration via openaiService\n');
console.log('Environment Check:');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set');
console.log('');

if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is required in backend/.env to run this test.');
  process.exit(1);
}

// Sample biometric data
const testData = {
  sampleCount: 1,
  providers: ['whoop'],
  lastUpdated: new Date().toISOString(),
  metrics: {
    readiness: 75,
    sleepQuality: 82,
    hrv: 95,
    strain: 11,
    restingHeartRate: 52,
    sleepHours: 7.5,
    recovery: 80
  }
};

const testEvents = [
  {
    title: 'Deep Work Session',
    start: new Date().setHours(10, 0, 0, 0),
    duration: 90,
    type: 'focus'
  }
];

const testWeather = {
  condition: 'Cloudy',
  temperature: '65°F'
};

console.log('Test Data:', JSON.stringify({ biometric: testData, events: testEvents, weather: testWeather }, null, 2));
console.log('\n--- Running analyzeAndGeneratePlaylistParams() ---\n');

analyzeAndGeneratePlaylistParams(testData, testEvents, testWeather)
  .then(result => {
    console.log('\n✓ Success! OpenAI analysis completed.');
    console.log('\nResult:');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(error => {
    console.error('\n✗ Error:', error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
    process.exit(1);
  });
