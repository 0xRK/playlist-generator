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
- Optional: WHOOP/Oura API keys if you plan to swap the sample payloads for real API calls.

## 1. Configure Environment Variables

Create `backend/.env` with the following keys:

```
PORT=3001
CLIENT_URL=http://localhost:5173
REDIRECT_URI=http://localhost:3001/auth/callback
SPOTIFY_CLIENT_ID=your-client-id
SPOTIFY_CLIENT_SECRET=your-client-secret
SPOTIFY_MARKET=US
```

> Tip: add `WHOOP_API_KEY` and `OURA_API_KEY` if/when you hook up their REST APIs directly.

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
| `/api/wearables/providers` | GET | Lists supported wearable adapters |
| `/api/wearables/sync` | POST | Normalizes WHOOP/Oura payloads and runs mood inference |
| `/api/mood/run` | POST | Re-computes mood from the latest aggregated metrics |
| `/api/mood` | GET | Returns the cached mood snapshot |
| `/api/playlists` | POST | Calls Spotify Search (or the fallback list) for the current mood |

Each route is slim and heavily commented so you can swap the in-memory store or mood heuristic with a real ML model later.

## Next Up

- Replace `SAMPLE_EVENTS` in the React app with live WHOOP/Oura fetches.
- Store wearable + mood history in a database instead of memory.
- Swap the heuristic model (`backend/src/services/moodModel.js`) for your ML model endpoint.
- Expand Spotify flows to create playlists on behalf of the user instead of just previewing tracks. The Spotify Web API makes this straightforward:
  1. `POST /v1/users/{user_id}/playlists` – create a new empty playlist for the user (requires `playlist-modify-public` or `playlist-modify-private` scope).
  2. `POST /v1/playlists/{playlist_id}/tracks` – add the track URIs we already fetch to that playlist.
  3. Optionally open the playlist for the user by linking to `https://open.spotify.com/playlist/{playlist_id}` or launch the Spotify app using a `spotify:playlist:{playlist_id}` URI.

Happy building! 🎧
