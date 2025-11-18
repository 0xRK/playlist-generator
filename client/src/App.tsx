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
      score: jitter(82, 6, 40, 100),
      hrv: jitter(108, 12, 40, 180),
      resting_heart_rate: jitter(44, 3, 38, 60),
    },
    sleep: {
      score: jitter(88, 5, 50, 100),
      quality_score: jitter(86, 6, 50, 100),
    },
    strain: jitter(12.7, 2, 0, 21),
  }),
  oura: () => ({
    timestamp: new Date().toISOString(),
    readiness: {
      score: jitter(61, 4, 30, 100),
      hrv_balance: jitter(70, 6, 20, 120),
      resting_heart_rate: jitter(51, 2, 40, 70),
    },
    sleep: {
      score: jitter(68, 4, 40, 100),
      resting_heart_rate: jitter(49, 2, 40, 80),
    },
    activity: {
      strain: jitter(0.45, 0.15, 0, 1),
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

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('access_token');
    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Step 1 – redirect to Spotify OAuth.
  const loginWithSpotify = useCallback(() => {
    window.location.href = `${API_URL}/auth/login`;
  }, []);

  /**
   * Step 2 – send a synthetic WHOOP/Oura payload to the backend so we can
   * compute mood heuristics without calling the real APIs yet.
   */
  const syncWearable = useCallback(async (provider: WearableProvider) => {
    setIsSyncing(true);
    setError(null);

    try {
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
  }, []);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Playlist generation failed');
    } finally {
      setIsGeneratingPlaylist(false);
    }
  }, [accessToken, mood]);

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
      syncWearable(provider).catch(err => setError(err instanceof Error ? err.message : 'Wearable sync failed'));
    },
    [syncWearable],
  );

  /**
   * Background auto-refresh: swap between providers every ~5 seconds to simulate
   * real wearable streams trickling in.
   */
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      syncWearable(currentProviderRef.current).catch(() => {
        /* ignore auto errors; manual controls already surface messages */
      });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [syncWearable]);

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
      </section>

      {/* Step 1 – Spotify */}
      <section className="panel connect-panel step-panel">
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
      </section>

      {/* Step 2 – Wearable samples */}
      <section className="panel step-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2>Send WHOOP / Oura sample data</h2>
          </div>
          <span className="status-pill">{isSyncing ? 'Syncing…' : 'Idle'}</span>
        </div>
        <p className="step-note">
          Data refreshes every ~5 seconds using the last provider you selected. Click a card to switch sources
          instantly.
        </p>

        <div className="card-grid">
          {WEARABLE_CARDS.map(config => (
            <article key={config.provider} className="card">
              <header>
                <p className="eyebrow">{config.provider.toUpperCase()}</p>
                <h3>{config.title}</h3>
                <p>{config.description}</p>
              </header>
              <button type="button" onClick={() => handleSampleClick(config.provider)} disabled={isSyncing}>
                {isSyncing && currentProviderRef.current === config.provider
                  ? 'Processing…'
                  : `Use ${config.provider} sample`}
              </button>
            </article>
          ))}
        </div>
        {latestSync && (
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
        )}
      </section>

      {/* Step 3 – Mood summary */}
      <section className="panel step-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 3</p>
            <h2>Mood inference</h2>
          </div>
          <span className="status-pill mood">{mood ? mood.label : 'Awaiting data'}</span>
        </div>

        {mood ? (
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
        )}
      </section>

      {/* Step 4 – Playlist */}
      <section className="panel step-panel">
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
        </div>

        {tracks.length > 0 ? (
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
        )}
      </section>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}

export default App;