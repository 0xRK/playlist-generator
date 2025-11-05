import { useState, useEffect } from 'react';

interface Track {
  id: string;
  name: string;
  artists: { name: string }[];
}

function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('access_token');
    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      fetch('http://localhost:3001/top-tracks', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
        .then(res => res.json())
        .then(data => setTracks(data.items));
    }
  }, [accessToken]);

  if (!accessToken) {
    return (
      <div>
        <h1>My Recently Played Songs</h1>
        <button onClick={() => window.location.href = 'http://localhost:3001/login'}>
          Login with Spotify
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>My Recently Played Songs</h1>
      <ol>
        {tracks.map(track => (
          <li key={track.id}>
            {track.name} - {track.artists.map(a => a.name).join(', ')}
          </li>
        ))}
      </ol>
    </div>
  );
}

export default App;