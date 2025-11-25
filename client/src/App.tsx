import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import './index.css';

type WearableProvider = 'whoop' | 'oura';

type FeatureVector = {
  readinessScore: number;
  recoveryScore: number;
  sleepScore: number;
  strainScore: number;
  restingHrScore: number;
};

type MoodSnapshot = {
  label: string;
  score: number;
  summary: string;
  recommendations: string[];
  playlistHints: {
    targetEnergy: number;
    targetValence: number;
    targetTempo: number;
  };
  featureVector: FeatureVector;
  updatedAt?: string;
};

type PlaylistTrack = {
  id: string;
  name: string;
  artists: string[];
  externalUrl?: string | null;
  preview_url?: string | null;
  uri?: string;
  albumArt?: string | null;
};

type NormalizedMetrics = {
  hrv: number | null;
  sleepQuality: number | null;
  strain: number | null;
  readiness: number | null;
  restingHeartRate: number | null;
};

type AggregatedMetrics = {
  sampleCount: number;
  providers: string[];
  lastUpdated: string;
  metrics: NormalizedMetrics;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function jitter(base: number, variance: number, min: number, max: number) {
  const delta = (Math.random() * 2 - 1) * variance;
  return clamp(Number((base + delta).toFixed(2)), min, max);
}

/**
 * Quick WHOOP/Oura sample generators so designers/devs can iterate without
 * wiring real device auth yet. Each call adds a small random delta.
 */
const SAMPLE_FACTORIES: Record<WearableProvider, () => Record<string, unknown>> = {
  whoop: () => ({
    timestamp: new Date().toISOString(),
    recovery: {
      score: jitter(80, 18, 20, 100),
      hrv: jitter(95, 30, 20, 190),
      resting_heart_rate: jitter(45, 6, 35, 70),
    },
    sleep: {
      score: jitter(82, 15, 20, 100),
      quality_score: jitter(80, 15, 20, 100),
    },
    strain: jitter(11, 4.5, 0, 21),
  }),
  oura: () => ({
    timestamp: new Date().toISOString(),
    readiness: {
      score: jitter(58, 20, 10, 100),
      hrv_balance: jitter(65, 18, 10, 150),
      resting_heart_rate: jitter(52, 5, 35, 80),
    },
    sleep: {
      score: jitter(66, 16, 10, 100),
      resting_heart_rate: jitter(50, 5, 35, 85),
    },
    activity: {
      strain: jitter(0.45, 0.35, 0, 1),
    },
  }),
};

const EMPTY_METRICS: NormalizedMetrics = {
  hrv: null,
  sleepQuality: null,
  strain: null,
  readiness: null,
  restingHeartRate: null,
};

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

type WearableSyncResponse = {
  mood: MoodSnapshot;
  normalizedMetrics?: NormalizedMetrics;
  aggregatedMetrics?: AggregatedMetrics | null;
  message?: string;
  authUrl?: string;
};

type PlaylistResponse = {
  tracks: PlaylistTrack[];
  source: 'spotify-search' | 'fallback';
  message?: string;
};

const WEARABLE_CARDS: Array<{
  provider: WearableProvider;
  title: string;
  description: string;
}> = [
    {
      provider: 'whoop',
      title: 'WHOOP Recovery + Strain',
      description: 'Simulates recovery, strain, and sleep metrics from WHOOP.',
    },
    {
      provider: 'oura',
      title: 'Oura Readiness + Sleep',
      description: 'Uses nightly readiness, HRV balance, and activity strain.',
    },
  ];

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [mood, setMood] = useState<MoodSnapshot | null>(null);
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [playlistSource, setPlaylistSource] = useState<'spotify-search' | 'fallback' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGeneratingPlaylist, setIsGeneratingPlaylist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latestSync, setLatestSync] = useState<{
    provider: WearableProvider;
    normalized: NormalizedMetrics;
    aggregated?: AggregatedMetrics | null;
  } | null>(null);
  const currentProviderRef = useRef<WearableProvider>('whoop');
  const [hasPlaylist, setHasPlaylist] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedPlaylistUrl, setSavedPlaylistUrl] = useState<string | null>(null);
  const [whoopAuthenticated, setWhoopAuthenticated] = useState(false);
  const [useRealWhoopData, setUseRealWhoopData] = useState(false);
  const [openaiResponse, setOpenaiResponse] = useState<string | null>(null);
  const userId = 'default'; // In production, get from user session

  const checkWhoopAuthStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/wearables/whoop/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (response.ok) {
        setWhoopAuthenticated(true);
      } else if (response.status === 401) {
        setWhoopAuthenticated(false);
      }
    } catch {
      setWhoopAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('access_token');
    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, '', '/');
    }

    // Check if Whoop auth was successful
    const whoopAuth = params.get('whoop_auth');
    if (whoopAuth === 'success') {
      setWhoopAuthenticated(true);
      setUseRealWhoopData(true);
      window.history.replaceState({}, '', '/');
    }

    // Check for Whoop OAuth errors
    const whoopError = params.get('error');
    if (whoopError) {
      const errorDetails = params.get('details') || whoopError;
      let errorMessage = 'Whoop authentication failed. ';

      if (whoopError === 'whoop_missing_code') {
        errorMessage += 'Authorization code was not received. This may happen if you denied access or if there\'s a redirect URI mismatch.';
      } else if (whoopError === 'whoop_oauth_error') {
        errorMessage += errorDetails;
      } else if (whoopError === 'whoop_auth_failed') {
        errorMessage += errorDetails || 'Token exchange failed.';
      } else {
        errorMessage += errorDetails || whoopError;
      }

      setError(errorMessage);
      window.history.replaceState({}, '', '/');
    }

    // Check Whoop auth status on mount
    checkWhoopAuthStatus();
  }, [checkWhoopAuthStatus]);

  // Step 1 – redirect to Spotify OAuth.
  const loginWithSpotify = useCallback(() => {
    window.location.href = `${API_URL}/auth/login`;
  }, []);

  // Whoop OAuth login
  const loginWithWhoop = useCallback(() => {
    window.location.href = `${API_URL}/auth/whoop/login?userId=${userId}`;
  }, []);

  /**
   * Fetch real Whoop data from API
   */
  const fetchWhoopData = useCallback(async () => {
    setIsSyncing(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/wearables/whoop/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = (await response.json()) as WearableSyncResponse;
      if (!response.ok) {
        if (response.status === 401 && data.authUrl) {
          setWhoopAuthenticated(false);
          throw new Error('Whoop authentication required. Please authenticate first.');
        }
        throw new Error(data.message || 'Failed to fetch Whoop data');
      }

      setMood(data.mood);
      setLatestSync({
        provider: 'whoop',
        normalized: data.normalizedMetrics ?? EMPTY_METRICS,
        aggregated: data.aggregatedMetrics ?? null,
      });
      setWhoopAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Whoop data fetch failed');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  /**
   * Step 2 – send a synthetic WHOOP/Oura payload to the backend so we can
   * compute mood heuristics without calling the real APIs yet.
   */
  const syncWearable = useCallback(async (provider: WearableProvider, useRealData = false) => {
    setIsSyncing(true);
    setError(null);

    try {
      // If Whoop and user wants real data, fetch from API
      if (provider === 'whoop' && useRealData) {
        await fetchWhoopData();
        return;
      }

      // Otherwise use sample data
      const response = await fetch(`${API_URL}/api/wearables/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          payload: SAMPLE_FACTORIES[provider](),
        }),
      });

      const data = (await response.json()) as WearableSyncResponse;
      if (!response.ok) {
        throw new Error(data.message || 'Failed to sync wearable');
      }

      setMood(data.mood);
      setLatestSync({
        provider,
        normalized: data.normalizedMetrics ?? EMPTY_METRICS,
        aggregated: data.aggregatedMetrics ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wearable sync failed');
    } finally {
      setIsSyncing(false);
    }
  }, [fetchWhoopData]);

  /**
   * Step 4 – request a playlist based on the currently inferred mood.
   */
  const generatePlaylist = useCallback(async () => {
    if (!accessToken) {
      setError('Connect Spotify before generating a playlist.');
      return;
    }
    if (!mood) {
      setError('Sync WHOOP or Oura data first to compute your mood.');
      return;
    }

    setIsGeneratingPlaylist(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken }),
      });

      const data = (await response.json()) as PlaylistResponse;
      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate playlist');
      }

      setTracks(data.tracks);
      setPlaylistSource(data.source);
      setHasPlaylist(true);
      // Store OpenAI response if available
      if ((data as any).mood?.playlistHints?.searchQuery) {
        setOpenaiResponse((data as any).mood.playlistHints.searchQuery);
      } else {
        setOpenaiResponse(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playlist generation failed');
    } finally {
      setIsGeneratingPlaylist(false);
    }
  }, [accessToken, mood]);

  const savePlaylist = useCallback(async () => {
    if (!accessToken) {
      setError('Connect Spotify before saving a playlist.');
      return;
    }
    const uris = tracks.map(track => track.uri).filter(Boolean);
    if (!uris.length) {
      setError('Generate a playlist before saving it.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSavedPlaylistUrl(null);

    try {
      const response = await fetch(`${API_URL}/api/playlists/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken,
          name: `Mood • ${mood?.label ?? 'playlist'}`,
          description: 'Generated from WHOOP/Oura metrics via the playlist-generator demo.',
          trackUris: uris,
        }),
      });

      const data = (await response.json()) as {
        playlistId: string;
        playlistUrl?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to save playlist');
      }

      if (data.playlistUrl) {
        setSavedPlaylistUrl(data.playlistUrl);
        window.open(data.playlistUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saving playlist failed');
    } finally {
      setIsSaving(false);
    }
  }, [accessToken, mood?.label, tracks]);

  const formatMetric = (value: number | null, suffix = '') => {
    if (value === null || Number.isNaN(value)) {
      return '—';
    }
    const display = Math.abs(value) < 10 ? value.toFixed(1) : value.toFixed(0);
    return `${display}${suffix}`;
  };

  const handleSampleClick = useCallback(
    (provider: WearableProvider) => {
      currentProviderRef.current = provider;
      const useReal = provider === 'whoop' && useRealWhoopData && whoopAuthenticated;
      syncWearable(provider, useReal).catch(err => setError(err instanceof Error ? err.message : 'Wearable sync failed'));
    },
    [syncWearable, useRealWhoopData, whoopAuthenticated],
  );


  return (
    <div className="app-shell">
      {/* Intro */}
      <section className="panel hero-panel">
        <header className="hero">
          <h1>Physiology-aware playlists</h1>
          <p className="lede">
            Log in with Spotify, stream WHOOP or Oura recovery data, infer your current mood, and generate a
            playlist tuned to your physiology.
          </p>
        </header>
      </section >

      {/* Step 1 – Spotify */}
      < section className="panel connect-panel step-panel" >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Connect Spotify</h2>
          </div>
          <span className={`status-pill ${accessToken ? 'status-pill-success' : ''}`}>
            {accessToken ? 'Connected' : 'Not connected'}
          </span>
        </div>
        <p className="connect-copy">
          Connecting first prevents you from losing WHOOP/Oura data if the page reloads during Spotify OAuth.
        </p>
        <div className="connect-actions">
          {accessToken ? (
            <div className="connected-state highlight">
              <p>Spotify access token active</p>
              <small>You can safely sync wearables and generate playlists.</small>
            </div>
          ) : (
            <button type="button" onClick={loginWithSpotify}>
              Login with Spotify
            </button>
          )}
          <small className="connect-hint">
            Need to switch accounts? Reconnecting will refresh this page.
          </small>
        </div>
      </section >

      {/* Step 2 – Wearable samples */}
      < section className="panel step-panel" >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2>Send WHOOP / Oura data</h2>
          </div>
          <span className="status-pill">{isSyncing ? 'Syncing…' : 'Idle'}</span>
        </div>
        <p className="step-note">
          Data refreshes every ~5 seconds using the last provider you selected. Click a card to switch sources
          instantly.
        </p>

        {/* Whoop Authentication */}
        {
          WEARABLE_CARDS.find(c => c.provider === 'whoop') && (
            <div className="whoop-auth-section" style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div>
                  <strong>Whoop API Integration</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#666' }}>
                    {whoopAuthenticated
                      ? 'Authenticated - Using real Whoop data'
                      : 'Not authenticated - Using sample data'}
                  </p>
                </div>
                <span className={`status-pill ${whoopAuthenticated ? 'status-pill-success' : ''}`}>
                  {whoopAuthenticated ? 'Connected' : 'Not connected'}
                </span>
              </div>
              {!whoopAuthenticated ? (
                <button type="button" onClick={loginWithWhoop} style={{ marginTop: '0.5rem' }}>
                  Authenticate with Whoop
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={useRealWhoopData}
                      onChange={(e) => setUseRealWhoopData(e.target.checked)}
                    />
                    <span>Use real Whoop API data</span>
                  </label>
                </div>
              )}
            </div>
          )
        }

        <div className="card-grid">
          {WEARABLE_CARDS.map(config => (
            <article key={config.provider} className="card">
              <header>
                <p className="eyebrow">{config.provider.toUpperCase()}</p>
                <h3>{config.title}</h3>
                <p>{config.description}</p>
              </header>
              <button
                type="button"
                onClick={() => handleSampleClick(config.provider)}
                disabled={isSyncing}
              >
                {isSyncing && currentProviderRef.current === config.provider
                  ? 'Processing…'
                  : config.provider === 'whoop' && useRealWhoopData && whoopAuthenticated
                    ? 'Fetch from Whoop API'
                    : `Use ${config.provider} sample`}
              </button>
            </article>
          ))}
        </div>
        {
          latestSync && (
            <div className="sync-summary">
              <div className="summary-header">
                <h3>{latestSync.provider.toUpperCase()} snapshot</h3>
                {latestSync.aggregated && (
                  <span className="status-pill small">
                    {latestSync.aggregated.sampleCount} samples total
                  </span>
                )}
              </div>
              <dl className="metrics-grid compact">
                <div>
                  <dt>Readiness</dt>
                  <dd>{formatMetric(latestSync.normalized.readiness)}</dd>
                </div>
                <div>
                  <dt>HRV</dt>
                  <dd>{formatMetric(latestSync.normalized.hrv, ' ms')}</dd>
                </div>
                <div>
                  <dt>Sleep score</dt>
                  <dd>{formatMetric(latestSync.normalized.sleepQuality)}</dd>
                </div>
                <div>
                  <dt>Strain</dt>
                  <dd>{formatMetric(latestSync.normalized.strain)}</dd>
                </div>
                <div>
                  <dt>Resting HR</dt>
                  <dd>{formatMetric(latestSync.normalized.restingHeartRate, ' bpm')}</dd>
                </div>
              </dl>
            </div>
          )
        }
      </section >

      {/* Step 3 – Mood summary */}
      < section className="panel step-panel" >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2>Mood inference</h2>
          </div>
          <span className="status-pill mood">{mood ? mood.label : 'Awaiting data'}</span>
        </div>

        {
          mood ? (
            <div className="mood-grid">
              <div>
                <p className="score-label">Mood score</p>
                <p className="mood-score">{Math.round(mood.score * 100)}</p>
                <p className="mood-summary">{mood.summary}</p>
                <ul>
                  {mood.recommendations.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="score-label">Signal blend</p>
                <dl className="metrics-grid">
                  <div>
                    <dt>Readiness</dt>
                    <dd>{Math.round(mood.featureVector.readinessScore * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Recovery</dt>
                    <dd>{Math.round(mood.featureVector.recoveryScore * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Sleep</dt>
                    <dd>{Math.round(mood.featureVector.sleepScore * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Strain</dt>
                    <dd>{Math.round(mood.featureVector.strainScore * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Resting HR</dt>
                    <dd>{Math.round(mood.featureVector.restingHrScore * 100)}%</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Send WHOOP or Oura test data to view mood insights.</p>
            </div>
          )
        }
      </section >

      {/* Step 4 – Playlist */}
      < section className="panel step-panel" >
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 4</p>
            <h2>Spotify playlist</h2>
          </div>
          <span className="status-pill">{playlistSource ? `${playlistSource} tracks` : 'Preview'}</span>
        </div>

        <div className="spotify-connect">
          {!accessToken && (
            <div className="connect-warning">
              <p>Connect Spotify above to pull live tracks.</p>
            </div>
          )}

          <button type="button" onClick={generatePlaylist} disabled={isGeneratingPlaylist || !accessToken}>
            {isGeneratingPlaylist
              ? hasPlaylist
                ? 'Refreshing…'
                : 'Generating…'
              : hasPlaylist
                ? 'Refresh playlist'
                : 'Generate playlist'}
          </button>
          {openaiResponse && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <strong style={{ color: '#0369a1' }}>✨ OpenAI Search Query:</strong>
              <p style={{ marginTop: '0.5rem', color: '#0c4a6e', fontFamily: 'monospace' }}>
                {openaiResponse}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={savePlaylist}
            disabled={isSaving || !accessToken || !tracks.length}
            className="tertiary-button"
          >
            {isSaving ? 'Saving…' : 'Save to Spotify'}
          </button>
        </div>

        {
          tracks.length > 0 ? (
            <ol className="track-list">
              {tracks.map(track => (
                <li key={track.id} className="track-card">
                  <div className="track-art">
                    {track.albumArt ? (
                      <img src={track.albumArt} alt={`${track.name} cover art`} loading="lazy" />
                    ) : (
                      <div className="track-art-placeholder">
                        {track.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="track-meta">
                    <p>{track.name}</p>
                    <small>{track.artists.join(', ')}</small>
                  </div>
                  <div className="track-actions">
                    {track.externalUrl && (
                      <a
                        href={track.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="preview-link track-link"
                      >
                        Open in Spotify
                      </a>
                    )}
                    {track.preview_url && (
                      <a
                        href={track.preview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="preview-link track-link track-preview"
                      >
                        Preview
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state">
              <p>No tracks yet. Generate a playlist to see recommendations.</p>
            </div>
          )
        }
        {
          savedPlaylistUrl && (
            <div className="save-banner">
              <p>
                Playlist saved.{' '}
                <a href={savedPlaylistUrl} target="_blank" rel="noreferrer">
                  Open in Spotify
                </a>
              </p>
            </div>
          )
        }
      </section >

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )
      }
    </div >
  );
}

export default App;