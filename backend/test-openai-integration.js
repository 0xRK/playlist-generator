#!/usr/bin/env node
/**
 * Quick test script to verify OpenAI integration in moodModel.js
 * 
 * Usage:
 *   node backend/test-openai-integration.js
 */

require('dotenv').config({ path: __dirname + '/.env' });
const { inferMood } = require('./src/services/moodModel');

console.log('🧪 Testing OpenAI Integration\n');
console.log('Environment Check:');
console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set');
console.log('');

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
    restingHeartRate: 52
  }
};

console.log('Test Data:', JSON.stringify(testData, null, 2));
console.log('\n--- Running inferMood() ---\n');

inferMood(testData)
  .then(result => {
    console.log('\n✓ Success! Mood inference completed.');
    console.log('\nResult:');
    console.log('- Mood:', result.label);
    console.log('- Score:', result.score);
    console.log('- Source:', result.source || 'heuristic');
    console.log('- Summary:', result.summary);
    console.log('\nFull result:', JSON.stringify(result, null, 2));

    if (result.source === 'openai') {
      console.log('\n🎉 OpenAI integration is working!');
    } else {
      console.log('\n⚠️  Using heuristic fallback (OpenAI not active)');
      if (!process.env.OPENAI_API_KEY) {
        console.log('   → Add OPENAI_API_KEY to backend/.env to enable AI inference');
      }
    }
  })
  .catch(error => {
    console.error('\n✗ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });

