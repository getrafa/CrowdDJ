'use client';

import React from 'react';

interface AmbientVisualizerProps {
  albumArtUrl?: string;
  isPlaying?: boolean;
}

export function AmbientVisualizer({ albumArtUrl, isPlaying = true }: AmbientVisualizerProps) {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Blurred Album Art Ambient Glow */}
      {albumArtUrl && (
        <div
          className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 scale-125 opacity-25 blur-3xl ${
            isPlaying ? 'animate-pulse-slow' : 'opacity-15'
          }`}
          style={{
            backgroundImage: `url(${albumArtUrl})`,
            filter: 'blur(70px) saturate(180%)',
          }}
        />
      )}

      {/* Dynamic Gradient Orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-1/3 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[140px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Subtle Noise Overlay for Texture */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900/50 via-neutral-950/80 to-black pointer-events-none" />
    </div>
  );
}
