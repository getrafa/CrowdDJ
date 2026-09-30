'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: any) => void;
    SpotifyIframeApi?: any;
  }
}

interface SpotifyIframePlayerProps {
  trackUri?: string | null;
  trackId?: string | null;
  playlistId?: string | null;
  height?: number; // 80 (compact), 152 (standard), or 352 (tall)
  onTrackEnded?: () => void;
  onPlaybackUpdate?: (state: { position: number; duration: number; isPaused: boolean }) => void;
  className?: string;
}

export function SpotifyIframePlayer({
  trackUri,
  trackId,
  playlistId,
  height = 152,
  onTrackEnded,
  onPlaybackUpdate,
  className = '',
}: SpotifyIframePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<any>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [embedReady, setEmbedReady] = useState(false);

  // Extract clean ID and determine Spotify URI
  const cleanTrackId = trackId
    ? trackId.replace('spotify:track:', '')
    : trackUri
    ? trackUri.replace('spotify:track:', '')
    : null;

  const currentUri = playlistId
    ? `spotify:playlist:${playlistId.replace('spotify:playlist:', '')}`
    : cleanTrackId
    ? `spotify:track:${cleanTrackId}`
    : 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b'; // Default fallback: Blinding Lights

  // Load Spotify IFrame API script once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.SpotifyIframeApi) {
      setIsApiReady(true);
      return;
    }

    const scriptId = 'spotify-iframe-api';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://open.spotify.com/embed/iframe-api/v1';
      script.async = true;
      document.body.appendChild(script);
    }

    const previousCallback = window.onSpotifyIframeApiReady;
    window.onSpotifyIframeApiReady = (IFrameAPI: any) => {
      window.SpotifyIframeApi = IFrameAPI;
      setIsApiReady(true);
      if (previousCallback) previousCallback(IFrameAPI);
    };
  }, []);

  // Initialize Embed Controller when API is ready
  useEffect(() => {
    if (!isApiReady || !window.SpotifyIframeApi || !containerRef.current) return;

    const element = containerRef.current;
    element.innerHTML = ''; // Clear placeholder

    const options = {
      uri: currentUri,
      width: '100%',
      height: `${height}`,
    };

    const callback = (EmbedController: any) => {
      controllerRef.current = EmbedController;
      setEmbedReady(true);

      // Listen for playback updates
      EmbedController.addListener('playback_update', (e: any) => {
        if (!e?.data) return;
        const { position, duration, isPaused } = e.data;

        if (onPlaybackUpdate) {
          onPlaybackUpdate({ position, duration, isPaused });
        }

        // Auto-advance track when current track reaches end
        if (duration > 0 && position > 0 && position >= duration - 1200) {
          if (onTrackEnded) {
            onTrackEnded();
          }
        }
      });
    };

    window.SpotifyIframeApi.createController(element, options, callback);

    return () => {
      controllerRef.current = null;
    };
  }, [isApiReady, height]);

  // Update track URI on controller when trackUri or playlistId changes
  useEffect(() => {
    if (controllerRef.current && currentUri && embedReady) {
      try {
        controllerRef.current.loadUri(currentUri);
        controllerRef.current.play();
      } catch (err) {
        console.warn('Could not load URI on Spotify Embed controller:', err);
      }
    }
  }, [currentUri, embedReady]);

  // If IFrame API is taking time or as clean fallback, render direct official Spotify iframe
  const fallbackEmbedUrl = playlistId
    ? `https://open.spotify.com/embed/playlist/${playlistId.replace('spotify:playlist:', '')}?utm_source=generator&theme=0`
    : `https://open.spotify.com/embed/track/${cleanTrackId || '0VjIjW4GlUZAMYd2vXMi3b'}?utm_source=generator&theme=0`;

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden bg-[#181818] shadow-xl border border-white/10 ${className}`}>
      {/* Container for Official Spotify IFrame API Controller */}
      <div ref={containerRef} className="w-full">
        {!embedReady && (
          <iframe
            src={fallbackEmbedUrl}
            width="100%"
            height={height}
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            className="w-full rounded-2xl"
          />
        )}
      </div>
    </div>
  );
}
