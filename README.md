# LLM Usage Disclosure

I used GPT-5 Codex High via Cursor throughout this project to act as a coding pair for the following tasks:

- **Architecture + scaffolding** – brainstorming the four-step UX, reorganizing backend services/routes, and drafting the README structure. I implemented each suggestion manually, verifying type usage and flow.
- **Implementation guidance** – generating starter code for the Express routes, Spotify search helper, React layout, and iterative styling tweaks (teal/cyan theme, amber panels, track cards). I reviewed, adapted, and tested all generated snippets before committing them.
- **Debugging & optimization** – diagnosing OAuth redirect issues, replacing the deprecated Spotify recommendations call with search, adding jittered wearable samples, introducing auto-refresh, and polishing the code (comments, constants, types).
- **Documentation** – refining wording for setup steps, environment variables, and next steps, plus composing this disclosure per the syllabus policy.

Using the LLM sped up iteration while still requiring me to reason about state management, API contracts, and visual design—reinforcing the course learning objectives rather than replacing my own work.

# Playlist Generator – Wearables → Mood → Spotify

This repository now scaffolds an end-to-end experience for turning WHOOP or Oura data into mood-aware Spotify playlists. The project ingests wearable metrics, runs them through a lightweight ML heuristic, then requests playlist recommendations tuned to the inferred mood.

## Architecture at a Glance

- **Backend (`/backend`)** – Node/Express API with routes for wearable ingestion, mood inference, and Spotify playlist generation. Spotify OAuth is already wired up via `/auth/login` and `/auth/callback`.
- **Client (`/client`)** – React + Vite dashboard that walks through three steps: send sample WHOOP/Oura data, inspect the mood snapshot, and request a playlist preview.
- **ML placeholder** – `moodModel.js` scores readiness/sleep/recovery/strain into four mood states (`flow`, `amped`, `recovery`, `reset`) and emits playlist hints (tempo, valence, energy) for the client UI.
- **Live Spotify search** – `playlistRoutes` now hits Spotify’s Search API (since the official Recommendations endpoint is deprecated for new apps) to pull fresh tracks tuned to the inferred mood. If Spotify rejects the call or no access token is provided, the API falls back to curated demo tracks.

## Prerequisites

- Node.js 18+
- A Spotify Developer app (needed for Client ID/Secret + redirect URI)
- Optional: WHOOP Developer account credentials (Client ID/Secret) for real-time data fetching

## 1. Configure Environment Variables

Create `backend/.env` with the following keys:

```
PORT=3001
CLIENT_URL=http://localhost:5173
REDIRECT_URI=http://localhost:3001/auth/callback
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_MARKET=US

# Whoop API Configuration (optional - for real-time data)
# Get these from https://developer.whoop.com/
WHOOP_CLIENT_ID=your-whoop-client-id
WHOOP_CLIENT_SECRET=your-whoop-client-secret
WHOOP_REDIRECT_URI=http://127.0.0.1:3001/auth/whoop/callback
```

> **Whoop API Setup**: To use real Whoop data instead of sample data:
> 1. Sign up at [Whoop Developer Platform](https://developer.whoop.com/)
> 2. Create an application to get your Client ID and Client Secret
> 3. **IMPORTANT**: In the Whoop Developer Dashboard, register the redirect URI. It must EXACTLY match `WHOOP_REDIRECT_URI`:
>    - The redirect URI is case-sensitive
>    - Must match exactly including protocol (`http://` vs `https://`), hostname (`127.0.0.1` vs `localhost`), port number, and path
>    - Example: If your `.env` has `http://127.0.0.1:3001/auth/whoop/callback`, register EXACTLY that in Whoop Dashboard
>    - Do NOT use `localhost` if your `.env` uses `127.0.0.1` (or vice versa)
> 4. Add the credentials to your `.env` file
> 5. Check server logs when authenticating - it will show the redirect URI being used

If you deploy the frontend separately, set `VITE_API_URL` in `client/.env` to point at the backend (defaults to `http://localhost:3001`).

## 2. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../client
npm install
```

## 3. Run the App

```bash
# Terminal 1
cd backend
npm start

# Terminal 2
cd client
npm run dev
```

Visit `http://localhost:5173`, sync a sample wearable, connect Spotify, then generate a playlist.

## API Surface (Backend)

| Route | Method | Purpose |
| --- | --- | --- |
| `/health` | GET | Basic readiness probe |
| `/auth/login` | GET | Redirects to Spotify OAuth |
| `/auth/callback` | GET | Handles Spotify token exchange |
| `/auth/whoop/login` | GET | Redirects to Whoop OAuth (requires `userId` query param) |
| `/auth/whoop/callback` | GET | Handles Whoop token exchange |
| `/auth/whoop/config` | GET | Checks if Whoop credentials are configured |
| `/api/wearables/providers` | GET | Lists supported wearable adapters |
| `/api/wearables/sync` | POST | Normalizes WHOOP/Oura payloads and runs mood inference (accepts manual payloads) |
| `/api/wearables/whoop/fetch` | POST | Fetches latest data from Whoop API and runs mood inference (requires Whoop auth) |
| `/api/mood/run` | POST | Re-computes mood from the latest aggregated metrics |
| `/api/mood` | GET | Returns the cached mood snapshot |
| `/api/playlists` | POST | Calls Spotify Search (or the fallback list) for the current mood |

Each route is slim and heavily commented so you can swap the in-memory store or mood heuristic with a real ML model later.

## Whoop API Integration

The backend includes full Whoop API v2 integration using the official endpoints:

1. **Authentication Flow**: Users authenticate via OAuth 2.0 at `/auth/whoop/login`
2. **Token Management**: Access tokens are stored in-memory (use a database in production) and automatically refreshed when expired
3. **Data Fetching**: The `/api/wearables/whoop/fetch` endpoint fetches data from:
   - `/developer/v2/recovery` - Recovery data (HRV, recovery score, resting heart rate)
   - `/developer/v2/activity/sleep` - Sleep data (sleep performance percentage, duration)
   - `/developer/v2/activity/workout` - Workout data (strain score)
4. **Automatic Normalization**: Fetched data is automatically normalized using the existing `whoopAdapter` and fed into the mood inference system

**API Endpoints Used**:
- Recovery: `GET /developer/v2/recovery` (with fallback to `/developer/v2/cycle`)
- Sleep: `GET /developer/v2/activity/sleep`
- Workout: `GET /developer/v2/activity/workout`

All endpoints require OAuth 2.0 authentication and support date range filtering via `start` and `end` query parameters.

**Usage Example**:
```bash
# 1. Authenticate with Whoop (redirects to Whoop OAuth)
curl http://localhost:3001/auth/whoop/login?userId=user123

# 2. After OAuth callback completes, fetch latest data
curl -X POST http://localhost:3001/api/wearables/whoop/fetch \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123"}'
```

For more details, see the [Whoop API Documentation](https://developer.whoop.com/api).

## Next Up

- Replace `SAMPLE_EVENTS` in the React app with live WHOOP/Oura fetches.
- Store wearable + mood history in a database instead of memory.
- Swap the heuristic model (`backend/src/services/moodModel.js`) for your ML model endpoint.
- Expand Spotify flows to create playlists on behalf of the user instead of just previewing tracks. The Spotify Web API makes this straightforward:
  1. `POST /v1/users/{user_id}/playlists` – create a new empty playlist for the user (requires `playlist-modify-public` or `playlist-modify-private` scope).
  2. `POST /v1/playlists/{playlist_id}/tracks` – add the track URIs we already fetch to that playlist.
  3. Optionally open the playlist for the user by linking to `https://open.spotify.com/playlist/{playlist_id}` or launch the Spotify app using a `spotify:playlist:{playlist_id}` URI.
- Update the React client to use `/api/wearables/whoop/fetch` instead of sample data
- Store wearable + mood history in a database instead of memory
- Implement proper user session management for multi-user support
- Swap the heuristic model (`backend/src/services/moodModel.js`) for your ML model endpoint
- Expand Spotify flows to create playlists on behalf of the user instead of just previewing tracks

Happy building! 🎧
