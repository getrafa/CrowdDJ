'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady: () => void;
    Spotify: any;
  }
}

interface UseSpotifyPlayerProps {
  token?: string | null;
  currentTrackUri?: string | null;
  onTrackEnded?: () => void;
}

export function useSpotifyPlayer({
  token,
  currentTrackUri,
  onTrackEnded,
}: UseSpotifyPlayerProps) {
  const [player, setPlayer] = useState<any>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isSimulated, setIsSimulated] = useState(false);

  const onTrackEndedRef = useRef(onTrackEnded);
  onTrackEndedRef.current = onTrackEnded;
  const currentUriRef = useRef(currentTrackUri);
  currentUriRef.current = currentTrackUri;

  // Initialize Web Playback SDK if valid token is provided
  useEffect(() => {
    if (!token || token.includes('mock') || token.includes('placeholder')) {
      setIsSimulated(true);
      setIsReady(true);
      return;
    }

    let spotifyPlayer: any = null;

    const initializeSDK = () => {
      if (!window.Spotify) return;

      spotifyPlayer = new window.Spotify.Player({
        name: 'CrowdDJ Host Deck',
        getOAuthToken: (cb: (token: string) => void) => {
          cb(token);
        },
        volume: 0.8,
      });

      spotifyPlayer.addListener('ready', ({ device_id }: { device_id: string }) => {
        setDeviceId(device_id);
        setIsReady(true);
        setIsSimulated(false);
        console.log('Spotify Web Playback SDK Ready with Device ID:', device_id);
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }: { device_id: string }) => {
        console.warn('Device ID has gone offline:', device_id);
        setIsReady(false);
      });

      spotifyPlayer.addListener('player_state_changed', (state: any) => {
        if (!state) return;

        setIsPlaying(!state.paused);
        setProgressMs(state.position);
        setDurationMs(state.duration);

        // Detect track ending (position reaches end or zero with paused after playing)
        if (
          state.paused &&
          state.position === 0 &&
          state.restrictions?.disallow_resuming_reasons?.length > 0
        ) {
          if (onTrackEndedRef.current) {
            onTrackEndedRef.current();
          }
        }
      });

      spotifyPlayer.addListener('initialization_error', ({ message }: { message: string }) => {
        console.warn('Spotify SDK initialization error:', message);
        setIsSimulated(true);
      });

      spotifyPlayer.addListener('authentication_error', ({ message }: { message: string }) => {
        console.warn('Spotify SDK authentication error:', message);
        setIsSimulated(true);
      });

      spotifyPlayer.addListener('account_error', ({ message }: { message: string }) => {
        console.warn('Spotify SDK account error (Requires Spotify Premium):', message);
        setIsSimulated(true);
      });

      spotifyPlayer.connect();
      setPlayer(spotifyPlayer);
    };

    if (window.Spotify) {
      initializeSDK();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initializeSDK;
      if (!document.getElementById('spotify-player-sdk')) {
        const script = document.createElement('script');
        script.id = 'spotify-player-sdk';
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    return () => {
      if (spotifyPlayer) {
        spotifyPlayer.disconnect();
      }
    };
  }, [token]);

  // Simulation playback timer when in simulated/preview mode
  useEffect(() => {
    if (!isSimulated || !isPlaying) return;

    const interval = setInterval(() => {
      setProgressMs((prev) => {
        const next = prev + 1000;
        if (durationMs > 0 && next >= durationMs) {
          if (onTrackEndedRef.current) {
            onTrackEndedRef.current();
          }
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSimulated, isPlaying, durationMs]);

  // Play track URI
  const playTrack = useCallback(
    async (trackUri: string, duration?: number) => {
      if (duration) {
        setDurationMs(duration);
      }
      setProgressMs(0);
      setIsPlaying(true);

      if (!isSimulated && player && deviceId && token) {
        try {
          await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ uris: [trackUri] }),
          });
        } catch (err) {
          console.error('Failed to trigger Spotify playback:', err);
        }
      }
    },
    [isSimulated, player, deviceId, token]
  );

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    if (isSimulated || !player) {
      setIsPlaying((prev) => !prev);
      return;
    }

    try {
      if (!isPlaying && currentUriRef.current && deviceId && token) {
        await playTrack(currentUriRef.current);
      } else {
        await player.togglePlay();
      }
    } catch (err) {
      setIsPlaying((prev) => !prev);
    }
  }, [isSimulated, player, isPlaying, deviceId, token, playTrack]);

  const pause = useCallback(async () => {
    setIsPlaying(false);
    if (!isSimulated && player) {
      await player.pause().catch(() => {});
    }
  }, [isSimulated, player]);

  const resume = useCallback(async () => {
    setIsPlaying(true);
    if (!isSimulated && player) {
      await player.resume().catch(() => {});
    }
  }, [isSimulated, player]);

  const seek = useCallback(
    async (ms: number) => {
      setProgressMs(ms);
      if (!isSimulated && player) {
        await player.seek(ms).catch(() => {});
      }
    },
    [isSimulated, player]
  );

  return {
    isReady,
    isPlaying,
    progressMs,
    durationMs,
    deviceId,
    isSimulated,
    setDurationMs,
    playTrack,
    togglePlay,
    pause,
    resume,
    seek,
  };
}
