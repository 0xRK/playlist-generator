# AI-Powered Playlist Generation

This document explains how to use the OpenAI integration to generate personalized playlists based on biometric data and calendar events.

## Overview

The AI playlist generation system uses OpenAI's GPT models to analyze:
- **Biometric data** from wearable devices (HRV, sleep quality, strain, readiness, etc.)
- **Calendar events** for the day (meetings, workouts, focus blocks, etc.)

It then generates intelligent music recommendations including:
- Mood classification (flow, amped, recovery, reset)
- Energy level (0.0-1.0)
- Valence/positivity (0.0-1.0)
- Tempo (BPM)
- Genre recommendations
- Optimized Spotify search queries

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Add your OpenAI API key to your `.env` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

Get your OpenAI API key from: https://platform.openai.com/api-keys

### 3. Start the Server

```bash
npm start
```

## API Endpoints

### POST `/api/ai-playlists`

Generates a complete AI-powered playlist with Spotify tracks.

**Request Body:**
```json
{
  "accessToken": "spotify-access-token",
  "calendarEvents": [
    {
      "title": "Team Standup",
      "start": "2024-01-15T09:00:00Z",
      "duration": 30,
      "type": "meeting"
    },
    {
      "title": "Deep Work Block",
      "start": "2024-01-15T10:00:00Z",
      "duration": 120,
      "type": "focus"
    },
    {
      "title": "Gym Workout",
      "start": "2024-01-15T17:00:00Z",
      "duration": 60,
      "type": "exercise"
    }
  ],
  "biometricOverride": {
    "metrics": {
      "readiness": 85,
      "sleepQuality": 78,
      "hrv": 65,
      "restingHeartRate": 58,
      "strain": 12.5
    }
  }
}
```

**Response:**
```json
{
  "aiAnalysis": {
    "mood": "flow",
    "energy": 0.65,
    "valence": 0.55,
    "tempo": 110,
    "genres": ["lo-fi", "ambient", "instrumental hip hop"],
    "searchQuery": "lo-fi ambient focus deep work",
    "reasoning": "High readiness and good sleep quality suggest optimal focus capacity. Calendar shows deep work blocks. Recommended moderate-energy, low-distraction music to support sustained concentration."
  },
  "tracks": [
    {
      "id": "track-id",
      "name": "Track Name",
      "artists": ["Artist Name"],
      "preview_url": "https://...",
      "uri": "spotify:track:...",
      "externalUrl": "https://...",
      "albumArt": "https://..."
    }
  ],
  "source": "spotify-search-ai",
  "biometricData": {
    "providers": ["oura"],
    "metrics": { ... },
    "lastUpdated": "2024-01-15T08:00:00Z",
    "sampleCount": 1
  }
}
```

### POST `/api/ai-playlists/analyze-only`

Gets AI analysis without fetching Spotify tracks (useful for testing or seeing recommendations).

**Request Body:** Same as above (accessToken not required)

**Response:**
```json
{
  "aiAnalysis": {
    "mood": "flow",
    "energy": 0.65,
    "valence": 0.55,
    "tempo": 110,
    "genres": ["lo-fi", "ambient", "instrumental hip hop"],
    "searchQuery": "lo-fi ambient focus deep work",
    "reasoning": "..."
  },
  "biometricData": { ... }
}
```

## Usage Examples

### Example 1: Using Stored Biometric Data

If you've already synced wearable data, you can omit `biometricOverride`:

```bash
curl -X POST http://localhost:3001/api/ai-playlists \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "your-spotify-token",
    "calendarEvents": [
      {
        "title": "Morning Workout",
        "start": "2024-01-15T07:00:00Z",
        "duration": 45,
        "type": "exercise"
      }
    ]
  }'
```

### Example 2: With Custom Biometric Data

```bash
curl -X POST http://localhost:3001/api/ai-playlists \
  -H "Content-Type: application/json" \
  -d '{
    "accessToken": "your-spotify-token",
    "calendarEvents": [],
    "biometricOverride": {
      "metrics": {
        "readiness": 45,
        "sleepQuality": 52,
        "hrv": 35,
        "restingHeartRate": 68,
        "strain": 15.2
      },
      "providers": ["whoop"],
      "lastUpdated": "2024-01-15T08:00:00Z"
    }
  }'
```

### Example 3: Analysis Only (No Spotify)

```bash
curl -X POST http://localhost:3001/api/ai-playlists/analyze-only \
  -H "Content-Type: application/json" \
  -d '{
    "calendarEvents": [
      {
        "title": "Client Presentation",
        "start": "2024-01-15T14:00:00Z",
        "duration": 60,
        "type": "meeting"
      }
    ],
    "biometricOverride": {
      "metrics": {
        "readiness": 72,
        "sleepQuality": 68,
        "hrv": 55
      }
    }
  }'
```

## Calendar Event Format

Calendar events support various formats. The key fields are:

```typescript
{
  title: string;          // Event name
  start: string | Date;   // ISO 8601 date string or Date object
  duration?: number;      // Duration in minutes (optional)
  type?: string;          // Event type: 'meeting', 'focus', 'exercise', etc. (optional)
}
```

## Mood Classifications

The AI can recommend four mood types:

- **flow**: Balanced recovery + sleep, ready for focused deep work
- **amped**: High physiological activation — great for workouts or high-energy tasks
- **recovery**: Body signaling fatigue — keep things calm and restorative
- **reset**: Mixed signals — stay flexible with moderate energy

## OpenAI Model

The system uses `gpt-4o-mini` by default for cost efficiency. You can upgrade to `gpt-4o` for potentially better results by editing `/backend/src/services/openaiService.js`:

```javascript
model: 'gpt-4o',  // Change from 'gpt-4o-mini'
```

## Integration with Existing Endpoints

The AI playlist system integrates seamlessly with your existing workflow:

1. **Sync wearable data**: `POST /api/wearables/sync`
2. **Generate AI playlist**: `POST /api/ai-playlists`

Or use the legacy flow:

1. **Sync wearable data**: `POST /api/wearables/sync`
2. **Compute mood**: `POST /api/mood`
3. **Get playlist**: `POST /api/playlists`

## Error Handling

The API handles various error cases:

- **401**: Invalid OpenAI API key
- **429**: OpenAI rate limit exceeded
- **400**: No biometric data available
- **502**: Spotify search failed (will use fallback tracks)

## Cost Considerations

OpenAI API calls incur costs:
- `gpt-4o-mini`: ~$0.0001-0.0002 per request
- `gpt-4o`: ~$0.005-0.010 per request

Each playlist generation makes one OpenAI API call.

## Files Created

- `/backend/src/services/openaiService.js` - Core OpenAI integration
- `/backend/src/routes/aiPlaylistRoutes.js` - API endpoints
- `/backend/src/services/spotifyService.js` - Updated to accept AI parameters
- `/backend/src/app.js` - Updated to register AI routes

## Testing

You can test the OpenAI integration without Spotify:

```javascript
// Test the formatting functions
const openaiService = require('./src/services/openaiService');

const biometricData = {
  metrics: { readiness: 85, sleepQuality: 78 },
  providers: ['oura']
};

const calendarEvents = [
  { title: 'Workout', start: new Date(), duration: 45 }
];

console.log(openaiService.formatBiometricData(biometricData));
console.log(openaiService.formatCalendarEvents(calendarEvents));
```

## Next Steps

1. Add OpenAI analysis to the frontend UI
2. Allow users to adjust AI recommendations
3. Track which AI recommendations perform best
4. Add support for Google Calendar integration
5. Cache AI responses to reduce API costs

