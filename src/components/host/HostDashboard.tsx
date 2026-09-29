'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRoomQueue } from '@/lib/hooks/useRoomQueue';
import { useSpotifyPlayer } from '@/lib/hooks/useSpotifyPlayer';
import { AmbientVisualizer } from '@/components/host/AmbientVisualizer';
import { formatDuration } from '@/lib/utils';
import {
  Play,
  Pause,
  SkipForward,
  Ban,
  Maximize2,
  Minimize2,
  Users,
  Copy,
  Check,
  Radio,
  Flame,
  Volume2,
  Sparkles,
  AlertTriangle,
  QrCode,
  ExternalLink,
  Plus,
  Music,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchModal } from '@/components/guest/SearchModal';

interface HostDashboardProps {
  roomCode: string;
  initialToken?: string | null;
}

export function HostDashboard({ roomCode, initialToken }: HostDashboardProps) {
  const [token, setToken] = useState<string | null>(initialToken || null);
  const [isCopied, setIsCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  // Determine current domain for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }
  }, []);

  const joinUrl = `${appUrl}/join/${roomCode.toUpperCase()}`;

  // Advance to next song workflow
  const handleAdvanceTrack = useCallback(
    async (reason: 'finish' | 'skip' | 'veto' = 'finish') => {
      console.log(`Advancing track due to: ${reason}`);
      const nextSong = await skipTrack(reason);
      if (nextSong) {
        await playTrack(nextSong.track_uri, nextSong.duration_ms);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Auto-skip callback triggered when downvote threshold is reached
  const handleAutoSkip = useCallback(
    async (nextTrack: any) => {
      console.log('AUTO-SKIP RULE FIRED! Transitioning to next song...');
      await skipTrack('skip');
      if (nextTrack) {
        await playTrack(nextTrack.track_uri, nextTrack.duration_ms);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const {
    room,
    queue,
    currentPlaying,
    activeGuests,
    addTrackToQueue,
    skipTrack,
    refreshQueue,
  } = useRoomQueue({
    roomCode,
    isHost: true,
    onAutoSkip: handleAutoSkip,
  });

  // Spotify Web Playback SDK Hook
  const {
    isReady,
    isPlaying,
    progressMs,
    durationMs,
    isSimulated,
    playTrack,
    togglePlay,
    setDurationMs,
  } = useSpotifyPlayer({
    token,
    currentTrackUri: currentPlaying?.track_uri,
    onTrackEnded: () => handleAdvanceTrack('finish'),
  });

  // Keep player duration in sync with currentPlaying duration
  useEffect(() => {
    if (currentPlaying?.duration_ms && durationMs === 0) {
      setDurationMs(currentPlaying.duration_ms);
    }
  }, [currentPlaying, durationMs, setDurationMs]);

  // Handle Fullscreen toggle for TV view
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Downvote Skip Threshold calculation
  const skipThresholdPercent = room?.skip_threshold_percent || 60;
  const currentDownvotes = currentPlaying?.downvotes || 0;
  const effectiveGuests = Math.max(1, activeGuests);
  const currentDownvotePercent = Math.round((currentDownvotes / effectiveGuests) * 100);
  const isNearSkip = currentDownvotePercent >= skipThresholdPercent * 0.7;

  const effectiveDuration = durationMs || currentPlaying?.duration_ms || 180000;
  const progressPercent = Math.min(100, (progressMs / effectiveDuration) * 100);

  return (
    <div className="relative min-h-screen bg-black text-white flex flex-col overflow-x-hidden selection:bg-emerald-500 selection:text-black">
      {/* Dynamic Ambient Visualizer Background */}
      <AmbientVisualizer
        albumArtUrl={currentPlaying?.album_art_url}
        isPlaying={isPlaying}
      />

      {/* Host TV Header Bar */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-black/40 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-black text-lg tracking-wider text-white">CrowdDJ</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-white/10 text-neutral-300 font-mono">
                HOST DECK
              </span>
            </div>
            <p className="text-xs text-neutral-400">TV Display &amp; Audio Broadcast</p>
          </div>
        </div>

        {/* Center: Prominent Room Code Pin */}
        <div className="flex items-center space-x-3 bg-neutral-900/80 border border-neutral-700/80 px-4 py-2 rounded-2xl shadow-xl">
          <span className="text-xs uppercase tracking-wider text-neutral-400 font-medium">
            Room Code:
          </span>
          <span className="font-mono text-2xl font-black tracking-widest text-emerald-400 select-all">
            {roomCode.toUpperCase()}
          </span>
        </div>

        {/* Right Controls: Presence, Copy Link, Fullscreen */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-white">{activeGuests}</span>
            <span className="text-neutral-400">Guests</span>
          </div>

          <button
            onClick={copyJoinLink}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition-colors"
            title="Copy Guest Join Link"
          >
            {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-neutral-400" />}
            <span>{isCopied ? 'Copied' : 'Share Link'}</span>
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-400 hover:text-white transition-colors"
            title="Toggle TV Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Split Layout: Hero Player (Left) + Upcoming Queue Feed & QR (Right) */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-8 max-w-7xl mx-auto w-full items-start">
        {/* HERO SECTION: Now Playing (8 Columns on desktop) */}
        <div className="lg:col-span-8 flex flex-col space-y-6">
          {currentPlaying ? (
            <div className="relative rounded-3xl bg-neutral-900/60 border border-white/10 backdrop-blur-xl p-8 shadow-2xl overflow-hidden">
              {/* Dynamic Glow Aura */}
              <div
                className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-30 blur-3xl pointer-events-none"
                style={{ backgroundColor: '#10b981' }}
              />

              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Large Album Artwork with Vinyl Spin Animation */}
                <div className="relative group shrink-0">
                  <div className="w-56 h-56 md:w-64 md:h-64 rounded-2xl overflow-hidden shadow-2xl border border-white/20 relative z-10 bg-neutral-950">
                    <img
                      src={currentPlaying.album_art_url}
                      alt={currentPlaying.track_name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Spinning Vinyl Record illusion behind sleeve */}
                  <div
                    className={`absolute -right-6 top-3 w-56 h-56 md:w-60 md:h-60 rounded-full bg-neutral-950 border-4 border-neutral-800 shadow-2xl flex items-center justify-center transition-transform z-0 ${
                      isPlaying ? 'animate-spin-slow' : ''
                    }`}
                  >
                    <div className="w-20 h-20 rounded-full border-4 border-neutral-700 bg-neutral-900 flex items-center justify-center">
                      <div className="w-5 h-5 rounded-full bg-emerald-500/80" />
                    </div>
                  </div>
                </div>

                {/* Track Details & Requester Info */}
                <div className="flex-1 flex flex-col justify-center text-center md:text-left min-w-0">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3 self-center md:self-start">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                    <span>Now Playing</span>
                  </div>

                  <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight truncate mb-1">
                    {currentPlaying.track_name}
                  </h2>
                  <p className="text-lg md:text-xl text-neutral-300 font-medium truncate mb-4">
                    {currentPlaying.artist_name}
                  </p>

                  <div className="inline-flex items-center space-x-2 text-sm text-neutral-400 self-center md:self-start bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                    <Sparkles className="w-4 h-4 text-party-purple" />
                    <span>
                      Requested by <strong className="text-emerald-300">@{currentPlaying.requested_by_name}</strong>
                    </span>
                  </div>

                  {/* Auto-Skip Threshold Warning Meter */}
                  <div className="mt-5 p-3 rounded-2xl bg-neutral-950/60 border border-white/5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-neutral-400 flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-party-pink" />
                        <span>Downvotes: <strong>{currentDownvotes}</strong> / {effectiveGuests} guests ({currentDownvotePercent}%)</span>
                      </span>
                      <span className="text-neutral-500">
                        Skip Trigger: {skipThresholdPercent}%
                      </span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          currentDownvotePercent >= skipThresholdPercent
                            ? 'bg-rose-500'
                            : isNearSkip
                            ? 'bg-amber-400'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, (currentDownvotePercent / skipThresholdPercent) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-8 space-y-2">
                <div className="w-full bg-neutral-800/80 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-md shadow-emerald-500/20"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-neutral-400">
                  <span>{formatDuration(progressMs)}</span>
                  <span>{formatDuration(effectiveDuration)}</span>
                </div>
              </div>

              {/* Host Audio Player Controls */}
              <div className="mt-6 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  {/* Play / Pause */}
                  <button
                    onClick={togglePlay}
                    className="w-12 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform active:scale-95"
                    title={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-0.5" />}
                  </button>

                  {/* Skip Song */}
                  <button
                    onClick={() => handleAdvanceTrack('skip')}
                    className="px-4 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white flex items-center space-x-2 text-sm font-semibold transition-all border border-white/5 active:scale-95"
                    title="Skip to next song in queue"
                  >
                    <SkipForward className="w-4 h-4" />
                    <span>Skip Next</span>
                  </button>

                  {/* Host Veto Button */}
                  <button
                    onClick={() => handleAdvanceTrack('veto')}
                    className="px-4 py-3 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 flex items-center space-x-2 text-sm font-semibold transition-all active:scale-95"
                    title="Host Veto: Instantly remove & skip inappropriate song"
                  >
                    <Ban className="w-4 h-4" />
                    <span>Host Veto</span>
                  </button>

                  {/* Add Track Button */}
                  <button
                    onClick={() => setIsSearchOpen(true)}
                    className="px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black flex items-center space-x-2 text-sm font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                    title="Search and add Spotify track"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>Add Song</span>
                  </button>
                </div>

                {/* Simulated / Spotify SDK Mode Badge */}
                <div className="text-right">
                  <span className="text-[11px] text-neutral-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
                    {isSimulated ? 'Browser Audio Deck (Ready)' : 'Spotify Connect Active'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl bg-neutral-900/60 border border-white/10 backdrop-blur-xl p-12 text-center shadow-2xl">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                <Radio className="w-10 h-10 animate-pulse" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Jukebox is Idle</h2>
              <p className="text-neutral-400 text-sm max-w-md mx-auto mb-6">
                Scan the QR code to join the room on your phone or search and add Spotify tracks right here!
              </p>
              <button
                onClick={() => setIsSearchOpen(true)}
                className="px-6 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold shadow-lg shadow-emerald-500/30 transition-all active:scale-95 inline-flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Search &amp; Add Spotify Track</span>
              </button>
            </div>
          )}

          {/* Equalizer Visualizer Bars */}
          <div className="flex items-end justify-center space-x-1.5 h-10 px-4">
            <span className={`w-1.5 bg-emerald-500/80 rounded-full ${isPlaying ? 'animate-equalizer-1' : 'h-1'}`} />
            <span className={`w-1.5 bg-teal-400/80 rounded-full ${isPlaying ? 'animate-equalizer-2' : 'h-1.5'}`} />
            <span className={`w-1.5 bg-party-purple/80 rounded-full ${isPlaying ? 'animate-equalizer-3' : 'h-2'}`} />
            <span className={`w-1.5 bg-party-pink/80 rounded-full ${isPlaying ? 'animate-equalizer-4' : 'h-1'}`} />
            <span className={`w-1.5 bg-emerald-400/80 rounded-full ${isPlaying ? 'animate-equalizer-2' : 'h-2.5'}`} />
            <span className={`w-1.5 bg-indigo-400/80 rounded-full ${isPlaying ? 'animate-equalizer-1' : 'h-1'}`} />
            <span className={`w-1.5 bg-emerald-500/80 rounded-full ${isPlaying ? 'animate-equalizer-3' : 'h-1.5'}`} />
          </div>
        </div>

        {/* SIDEBAR: Top 5 Upcoming Songs + Dynamic QR Code (4 Columns on desktop) */}
        <div className="lg:col-span-4 flex flex-col space-y-6">
          {/* Prominent Dynamic QR Code Card */}
          <div className="rounded-3xl bg-neutral-900/80 border border-white/10 backdrop-blur-xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
              <QrCode className="w-4 h-4" />
              <span>Scan to Join the Party</span>
            </div>

            {/* QR Code Container */}
            <div
              onClick={() => setIsQrModalOpen(true)}
              className="p-3 bg-white rounded-2xl shadow-xl hover:scale-105 transition-transform cursor-pointer group"
              title="Click to expand QR Code"
            >
              <QRCodeSVG
                value={joinUrl}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>

            <p className="mt-3 font-mono text-xl font-black text-white tracking-widest">
              {roomCode.toUpperCase()}
            </p>
            <p className="text-xs text-neutral-400 mt-1 max-w-[220px]">
              No app download required. Scan to vote &amp; request tracks!
            </p>

            <button
              onClick={() => window.open(joinUrl, '_blank')}
              className="mt-3 flex items-center space-x-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
            >
              <span>Open Guest View in new tab</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Top 5 Upcoming Songs in Queue */}
          <div className="rounded-3xl bg-neutral-900/80 border border-white/10 backdrop-blur-xl p-6 shadow-2xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-party-pink" />
                <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                  Top 5 Upcoming
                </h3>
              </div>
              <span className="text-xs text-neutral-400 font-mono">
                {queue.length} in queue
              </span>
            </div>

            {/* Queue List */}
            <div className="space-y-3 flex-1">
              {queue.slice(0, 5).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center space-x-3 min-w-0 flex-1 mr-2">
                    <span className="text-xs font-mono font-bold text-neutral-500 w-4 text-center">
                      #{index + 1}
                    </span>
                    <img
                      src={item.album_art_url}
                      alt={item.track_name}
                      className="w-10 h-10 rounded-xl object-cover bg-neutral-950 shrink-0 shadow-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">
                        {item.track_name}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {item.artist_name}
                      </p>
                      <span className="text-[10px] text-neutral-500">
                        @{item.requested_by_name}
                      </span>
                    </div>
                  </div>

                  {/* Score Badge */}
                  <div className="flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-neutral-800/80 border border-neutral-700/60 shrink-0">
                    <span
                      className={`text-xs font-mono font-bold ${
                        item.score > 0
                          ? 'text-emerald-400'
                          : item.score < 0
                          ? 'text-rose-400'
                          : 'text-neutral-400'
                      }`}
                    >
                      {item.score > 0 ? `+${item.score}` : item.score}
                    </span>
                  </div>
                </div>
              ))}

              {queue.length === 0 && (
                <div className="text-center py-8 text-neutral-500 text-xs">
                  No upcoming songs in the queue yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Full-Screen QR Code Modal */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl max-w-md w-full flex flex-col items-center text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-white mb-1">Scan with Phone Camera</h3>
            <p className="text-xs text-neutral-400 mb-6">Join room to vote and request songs</p>
            <div className="p-4 bg-white rounded-2xl shadow-2xl mb-6">
              <QRCodeSVG value={joinUrl} size={260} level="H" />
            </div>
            <div className="font-mono text-3xl font-black tracking-widest text-emerald-400 mb-2">
              {roomCode.toUpperCase()}
            </div>
            <button
              onClick={() => setIsQrModalOpen(false)}
              className="mt-4 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Host Search & Add Spotify Tracks Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        roomCode={roomCode}
        guestName="Host"
        isLimitReached={false}
        maxRequests={999}
        userRequestsCount={0}
        onAddTrack={async (track, guestName) => {
          const item = await addTrackToQueue(track, guestName);
          if (!currentPlaying) {
            await playTrack(track.uri, track.duration_ms);
          }
          return item;
        }}
      />
    </div>
  );
}
