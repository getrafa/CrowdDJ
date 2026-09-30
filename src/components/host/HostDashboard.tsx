'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useRoomQueue } from '@/lib/hooks/useRoomQueue';
import { useSpotifyPlayer } from '@/lib/hooks/useSpotifyPlayer';
import { AmbientVisualizer } from '@/components/host/AmbientVisualizer';
import { formatDuration } from '@/lib/utils';
import { SpotifyTrack } from '@/types/database';
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
  VolumeX,
  Sparkles,
  QrCode,
  Search,
  ListMusic,
  Plus,
  Home,
  Library,
  Music,
  Clock,
  Heart,
  Loader2,
  Shuffle,
  Repeat,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpotifyIframePlayer } from './SpotifyIframePlayer';

interface HostDashboardProps {
  roomCode: string;
  initialToken?: string | null;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
}

export function HostDashboard({ roomCode, initialToken }: HostDashboardProps) {
  const [token, setToken] = useState<string | null>(() => {
    if (initialToken) return initialToken;
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('spotify_host_token') || localStorage.getItem('spotify_host_token');
    }
    return null;
  });

  useEffect(() => {
    if (token && typeof window !== 'undefined') {
      sessionStorage.setItem('spotify_host_token', token);
      localStorage.setItem('spotify_host_token', token);
    }
  }, [token]);

  const [isCopied, setIsCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [appUrl, setAppUrl] = useState('');

  // Spotify Library & Search States
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topHitsTitle, setTopHitsTitle] = useState('Top Party Hits');
  const [isTopHitsActive, setIsTopHitsActive] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingTracks, setLoadingTracks] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [showPlaylistEmbed, setShowPlaylistEmbed] = useState(true);

  // Determine current domain for QR code
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAppUrl(window.location.origin);
    }
  }, []);

  const safeRoomCode = roomCode ? roomCode.toUpperCase() : 'PARTY';
  const joinUrl = `${appUrl}/join/${safeRoomCode}`;

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
    roomCode: safeRoomCode,
    isHost: true,
    onAutoSkip: handleAutoSkip,
  });

  // Sync token from room if not present in initial URL
  useEffect(() => {
    if (!token && room?.host_spotify_token) {
      setToken(room.host_spotify_token);
    }
  }, [room, token]);

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

  // Fetch top party tracks or user's top tracks
  const fetchTopTracks = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/spotify/top-tracks?roomCode=${encodeURIComponent(safeRoomCode)}${tokenQuery}`, { headers });
      const data = await res.json();
      if (data.tracks && Array.isArray(data.tracks)) {
        setTopTracks(data.tracks);
        if (data.title) setTopHitsTitle(data.title);
      }
    } catch (err) {
      console.warn('Failed to fetch top tracks:', err);
    }
  }, [safeRoomCode, token]);

  useEffect(() => {
    fetchTopTracks();
  }, [fetchTopTracks]);

  const handleSelectTopHits = () => {
    setSelectedPlaylist(null);
    setSearchQuery('');
    setIsTopHitsActive(true);
  };

  // Fetch host's actual Spotify playlists
  const fetchPlaylists = useCallback(async () => {
    setLoadingPlaylists(true);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
      const res = await fetch(`/api/spotify/playlists?roomCode=${encodeURIComponent(safeRoomCode)}${tokenQuery}`, { headers });
      const data = await res.json();
      if (data.newAccessToken) {
        setToken(data.newAccessToken);
      }
      if (data.playlists && Array.isArray(data.playlists)) {
        setPlaylists(data.playlists);
      }
    } catch (err) {
      console.error('Failed to load host playlists:', err);
    } finally {
      setLoadingPlaylists(false);
    }
  }, [safeRoomCode, token]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Fetch songs inside selected playlist
  const handleSelectPlaylist = async (playlist: Playlist) => {
    setIsTopHitsActive(false);
    setSelectedPlaylist(playlist);
    setSearchQuery('');
    setPlaylistTracks([]);
    setLoadingTracks(true);
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
      const res = await fetch(
        `/api/spotify/playlists/${playlist.id}?roomCode=${encodeURIComponent(safeRoomCode)}${tokenQuery}`,
        { headers }
      );
      const data = await res.json();
      if (data.newAccessToken) {
        setToken(data.newAccessToken);
      }
      if (data.tracks && Array.isArray(data.tracks)) {
        setPlaylistTracks(data.tracks);
      } else {
        console.warn('Playlist tracks response without array:', data);
      }
    } catch (err) {
      console.error('Failed to load playlist songs:', err);
    } finally {
      setLoadingTracks(false);
    }
  };

  // Live Spotify Track Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const headers: Record<string, string> = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';
        const res = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(searchQuery)}&roomCode=${encodeURIComponent(safeRoomCode)}${tokenQuery}`,
          { headers }
        );
        const data = await res.json();
        if (data.tracks) {
          setSearchResults(data.tracks);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, safeRoomCode, token]);

  // Play track immediately & queue to party
  const handlePlayNow = async (track: SpotifyTrack) => {
    try {
      await addTrackToQueue(track, 'Host');
      await playTrack(track.uri, track.duration_ms);
      setAddedIds((prev) => new Set(prev).add(track.id));
    } catch (err) {
      console.error('Error playing track:', err);
    }
  };

  // Add track to queue only
  const handleAddToQueue = async (track: SpotifyTrack, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await addTrackToQueue(track, 'Host');
      setAddedIds((prev) => new Set(prev).add(track.id));
      if (!currentPlaying) {
        await playTrack(track.uri, track.duration_ms);
      }
    } catch (err) {
      console.error('Error adding track to queue:', err);
    }
  };

  const displayedTracks = searchQuery.trim()
    ? searchResults
    : isTopHitsActive || !selectedPlaylist
    ? topTracks
    : playlistTracks;

  // Queue entire playlist or top tracks at once
  const handleQueueAllPlaylist = async () => {
    if (!displayedTracks.length) return;
    for (const track of displayedTracks) {
      await addTrackToQueue(track, 'Host');
    }
    if (!currentPlaying && displayedTracks[0]) {
      await playTrack(displayedTracks[0].uri, displayedTracks[0].duration_ms);
    }
  };

  // Fullscreen toggle
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

  const effectiveDuration = durationMs || currentPlaying?.duration_ms || 180000;
  const progressPercent = Math.min(100, (progressMs / effectiveDuration) * 100);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] text-white overflow-hidden font-sans select-none">
      {/* Dynamic Ambient Background Glow */}
      <AmbientVisualizer
        albumArtUrl={currentPlaying?.album_art_url || selectedPlaylist?.images?.[0]?.url}
        isPlaying={isPlaying}
      />

      {/* Main 3-Column Workspace */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* 1. LEFT SIDEBAR: Spotify Navigation & Playlists */}
        <aside className="w-64 bg-black/85 backdrop-blur-md flex flex-col border-r border-[#282828] p-4 shrink-0">
          {/* Top Brand */}
          <div className="flex items-center space-x-2.5 px-2 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#1db954] flex items-center justify-center text-black shadow-lg shadow-[#1db954]/20">
              <Radio className="w-4 h-4 animate-pulse stroke-[2.5]" />
            </div>
            <div>
              <span className="font-black text-base tracking-tight text-white">CrowdDJ</span>
              <span className="text-[10px] block font-mono text-[#1db954] uppercase tracking-wider font-bold">
                Spotify Host
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 mb-6 text-sm font-semibold">
            <button
              onClick={handleSelectTopHits}
              className={`flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg transition-colors ${
                isTopHitsActive || (!selectedPlaylist && !searchQuery.trim())
                  ? 'bg-[#282828] text-[#1db954] font-bold shadow'
                  : 'text-neutral-300 hover:text-white hover:bg-[#282828]'
              }`}
            >
              <Flame className="w-5 h-5 text-[#1db954]" />
              <span>Top Party Hits</span>
            </button>
            <div className="relative pt-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Spotify..."
                className="w-full bg-[#242424] border border-[#3e3e3e] rounded-full pl-9 pr-3 py-2 text-xs text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-[#1db954]"
              />
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            </div>
          </nav>

          {/* Library Header */}
          <div className="flex items-center justify-between px-2 pb-2 border-b border-[#282828] text-xs font-bold text-neutral-400 uppercase tracking-wider">
            <div className="flex items-center space-x-2">
              <Library className="w-4 h-4" />
              <span>Your Playlists</span>
            </div>
            <span className="text-[10px] font-mono text-[#1db954]">{playlists.length}</span>
          </div>

          {/* Playlists List */}
          <div className="flex-1 overflow-y-auto mt-2 space-y-1 pr-1 custom-scrollbar">
            {loadingPlaylists && (
              <div className="p-4 text-center text-xs text-neutral-500 flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#1db954]" />
                <span>Loading playlists...</span>
              </div>
            )}

            {playlists.map((pl) => {
              const isSelected = selectedPlaylist?.id === pl.id && !searchQuery.trim();
              return (
                <button
                  key={pl.id}
                  onClick={() => handleSelectPlaylist(pl)}
                  className={`flex items-center space-x-3 w-full p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-[#282828] text-white shadow-md'
                      : 'text-neutral-400 hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <img
                    src={pl.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=60'}
                    alt={pl.name}
                    className="w-10 h-10 rounded-lg object-cover bg-neutral-900 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-[#1db954]' : 'text-white'}`}>
                      {pl.name}
                    </p>
                    <p className="text-[10px] text-neutral-500 truncate">
                      Playlist &bull; {pl.owner?.display_name || 'Spotify'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* 2. CENTER: Spotify Content Area (Songs & Tracks) */}
        <main className="flex-1 flex flex-col overflow-y-auto bg-gradient-to-b from-[#1e3264]/40 via-[#121212]/90 to-[#121212] backdrop-blur-sm">
          {/* Header Banner for Selected Playlist or Search */}
          <div className="p-8 flex items-end space-x-6 bg-gradient-to-b from-white/10 to-transparent">
            {searchQuery.trim() ? (
              <div className="w-44 h-44 rounded-2xl bg-[#282828] shadow-2xl flex items-center justify-center text-[#1db954] shrink-0 border border-white/10">
                <Search className="w-16 h-16" />
              </div>
            ) : isTopHitsActive || !selectedPlaylist ? (
              <div className="w-44 h-44 rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 shadow-2xl flex items-center justify-center text-white shrink-0 border border-white/10">
                <Flame className="w-16 h-16 fill-current animate-pulse text-white" />
              </div>
            ) : (
              <img
                src={selectedPlaylist?.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400'}
                alt={selectedPlaylist?.name || 'Playlist'}
                className="w-44 h-44 rounded-2xl object-cover shadow-2xl shrink-0 border border-white/10"
              />
            )}

            <div className="min-w-0 flex-1">
              <span className="text-xs uppercase font-extrabold tracking-widest text-[#1db954]">
                {searchQuery.trim()
                  ? 'Spotify Search'
                  : isTopHitsActive || !selectedPlaylist
                  ? 'CrowdDJ Featured'
                  : 'Public Playlist'}
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight mt-1 truncate">
                {searchQuery.trim()
                  ? `Search: "${searchQuery}"`
                  : isTopHitsActive || !selectedPlaylist
                  ? topHitsTitle
                  : selectedPlaylist?.name || 'Your Spotify Music'}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-2 line-clamp-2">
                {searchQuery.trim()
                  ? `Showing top Spotify tracks matching "${searchQuery}"`
                  : isTopHitsActive || !selectedPlaylist
                  ? 'High-energy tracks ready to play and vote on in the CrowdDJ room.'
                  : selectedPlaylist?.description || 'Select any song to play or queue to the party room.'}
              </p>
              <div className="flex items-center space-x-2 mt-3 text-xs text-neutral-300">
                <span className="font-semibold text-white">
                  {isTopHitsActive || !selectedPlaylist
                    ? 'Spotify'
                    : selectedPlaylist?.owner?.display_name || 'Host'}
                </span>
                <span>&bull;</span>
                <span>
                  {loadingTracks
                    ? 'Loading tracks...'
                    : displayedTracks.length > 0
                    ? `${displayedTracks.length} songs`
                    : selectedPlaylist?.tracks?.total
                    ? `${selectedPlaylist.tracks.total} songs`
                    : '0 songs'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Bar: Big Green Play Button & Queue All */}
          <div className="px-8 py-4 flex items-center space-x-4 border-b border-[#282828]">
            <button
              onClick={() => {
                if (displayedTracks[0]) handlePlayNow(displayedTracks[0]);
              }}
              className="w-14 h-14 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl shadow-[#1db954]/30 hover:scale-105 active:scale-95 transition-all"
              title="Play Playlist"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>

            {!searchQuery.trim() && (
              <button
                onClick={handleQueueAllPlaylist}
                className="px-4 py-2.5 rounded-full bg-[#282828] hover:bg-[#383838] text-white text-xs font-bold transition-all border border-white/5 active:scale-95 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4 text-[#1db954]" />
                <span>Import Playlist to Party Queue</span>
              </button>
            )}

            {selectedPlaylist && (
              <button
                onClick={() => setShowPlaylistEmbed(!showPlaylistEmbed)}
                className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all border flex items-center space-x-2 ${
                  showPlaylistEmbed
                    ? 'bg-[#1db954]/20 border-[#1db954]/50 text-[#1db954]'
                    : 'bg-[#282828] border-white/5 text-neutral-300 hover:text-white'
                }`}
              >
                <Radio className="w-4 h-4" />
                <span>{showPlaylistEmbed ? 'Hide Spotify Player' : 'Official Spotify Player'}</span>
              </button>
            )}
          </div>

          {/* Official Spotify Playlist Player Embed */}
          {selectedPlaylist && showPlaylistEmbed && (
            <div className="px-8 py-3 bg-black/40 border-b border-[#282828]">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                <span className="flex items-center space-x-1.5">
                  <Music className="w-3.5 h-3.5 text-[#1db954]" />
                  <span>Official Spotify Player: {selectedPlaylist.name}</span>
                </span>
                <span className="text-[10px] text-[#1db954] font-mono">Official Spotify Embed</span>
              </div>
              <SpotifyIframePlayer
                playlistId={selectedPlaylist.id}
                height={152}
                onTrackEnded={() => handleAdvanceTrack('finish')}
              />
            </div>
          )}

          {/* Songs Table Header */}
          <div className="px-8 py-3 text-xs font-semibold text-neutral-400 grid grid-cols-12 gap-4 border-b border-[#282828]/60 uppercase tracking-wider sticky top-0 bg-[#121212]/95 backdrop-blur-md z-10">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-6">Title</span>
            <span className="col-span-3">Album</span>
            <span className="col-span-2 text-right flex items-center justify-end pr-2">
              <Clock className="w-4 h-4 mr-1" />
              <span>Time</span>
            </span>
          </div>

          {/* Songs Table Rows */}
          <div className="px-6 py-2 flex-1 space-y-1">
            {loadingTracks && (
              <div className="py-20 text-center text-xs text-neutral-400 flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#1db954] mb-2" />
                <span>Loading tracks from Spotify...</span>
              </div>
            )}

            {displayedTracks.map((track, idx) => {
              const isCurrent = currentPlaying?.track_uri === track.uri;
              const isAdded = addedIds.has(track.id);

              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => handlePlayNow(track)}
                  className={`grid grid-cols-12 gap-4 items-center px-4 py-2.5 rounded-xl transition-all group cursor-pointer ${
                    isCurrent
                      ? 'bg-[#282828] text-[#1db954]'
                      : 'hover:bg-[#282828]/60 text-neutral-300 hover:text-white'
                  }`}
                >
                  {/* # or Play Icon */}
                  <div className="col-span-1 flex items-center justify-center text-xs font-mono">
                    <span className="group-hover:hidden">{idx + 1}</span>
                    <Play className="w-4 h-4 fill-current hidden group-hover:inline-block text-[#1db954]" />
                  </div>

                  {/* Title & Artist */}
                  <div className="col-span-6 flex items-center space-x-3 min-w-0">
                    <img
                      src={track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80'}
                      alt={track.name}
                      className="w-10 h-10 rounded-md object-cover bg-black shrink-0 shadow-md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-semibold truncate ${isCurrent ? 'text-[#1db954]' : 'text-white'}`}>
                        {track.name}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {track.artists?.map((a: any) => a.name).join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Album Name */}
                  <div className="col-span-3 text-xs text-neutral-400 truncate">
                    {track.album?.name || 'Single'}
                  </div>

                  {/* Duration & Quick Queue Action */}
                  <div className="col-span-2 flex items-center justify-end space-x-3 text-xs pr-2">
                    <button
                      onClick={(e) => handleAddToQueue(track, e)}
                      className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                        isAdded
                          ? 'bg-[#1db954]/20 text-[#1db954]'
                          : 'bg-[#383838] hover:bg-[#1db954] hover:text-black text-white'
                      }`}
                      title="Add to CrowdDJ party queue"
                    >
                      {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                    <span className="font-mono text-neutral-400">{formatDuration(track.duration_ms)}</span>
                  </div>
                </div>
              );
            })}

            {displayedTracks.length === 0 && !loadingTracks && (
              <div className="py-20 text-center text-xs text-neutral-400 max-w-sm mx-auto flex flex-col items-center space-y-3">
                <p className="text-neutral-300 font-medium">No songs found in this selection.</p>
                <div className="flex items-center space-x-3">
                  {selectedPlaylist && (
                    <button
                      onClick={() => handleSelectPlaylist(selectedPlaylist)}
                      className="px-4 py-2 rounded-full bg-[#282828] hover:bg-[#383838] text-white text-xs font-semibold border border-white/10 transition-all hover:scale-105 active:scale-95"
                    >
                      Refresh
                    </button>
                  )}
                  <button
                    onClick={handleSelectTopHits}
                    className="px-4 py-2 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black text-xs font-bold transition-all hover:scale-105 active:scale-95 flex items-center space-x-1.5"
                  >
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>View Top Party Hits</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* 3. RIGHT SIDEBAR: CrowdDJ Party HUD & Live Queue */}
        <aside className="w-80 bg-black/90 backdrop-blur-md border-l border-[#282828] flex flex-col p-4 shrink-0 overflow-y-auto">
          {/* Official Spotify IFrame Player */}
          <div className="p-3.5 rounded-2xl bg-[#181818] border border-[#282828] mb-4">
            <div className="flex items-center justify-between text-xs font-bold text-neutral-400 mb-2 px-1 uppercase tracking-wider">
              <span className="flex items-center space-x-1.5">
                <Music className="w-3.5 h-3.5 text-[#1db954]" />
                <span>Spotify Player</span>
              </span>
              <span className="text-[10px] text-[#1db954] font-mono">Official Embed</span>
            </div>
            <SpotifyIframePlayer
              trackUri={currentPlaying?.track_uri}
              height={152}
              onTrackEnded={() => handleAdvanceTrack('finish')}
            />
          </div>

          {/* Top Room Banner */}
          <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] mb-4 text-center">
            <span className="text-[11px] uppercase tracking-wider font-extrabold text-[#1db954]">
              Party Room Code
            </span>
            <div className="font-mono text-3xl font-black tracking-widest text-white mt-1">
              {safeRoomCode}
            </div>
            <div className="flex items-center justify-center space-x-2 mt-2 text-xs text-neutral-400">
              <Users className="w-3.5 h-3.5 text-[#1db954]" />
              <span>{activeGuests} {activeGuests === 1 ? 'Guest' : 'Guests'} online</span>
            </div>
          </div>

          {/* Dynamic Guest QR Code */}
          <div className="p-4 rounded-2xl bg-[#181818] border border-[#282828] mb-4 flex flex-col items-center text-center">
            <span className="text-xs font-bold text-white mb-2 flex items-center space-x-1.5">
              <QrCode className="w-4 h-4 text-[#1db954]" />
              <span>Scan to Vote &amp; Request</span>
            </span>

            <div
              onClick={() => setIsQrModalOpen(true)}
              className="p-3 bg-white rounded-xl shadow-xl hover:scale-105 transition-transform cursor-pointer"
              title="Click to expand QR Code"
            >
              <QRCodeSVG value={joinUrl} size={150} level="M" />
            </div>

            <button
              onClick={copyJoinLink}
              className="mt-3 flex items-center space-x-1.5 text-xs text-neutral-400 hover:text-white"
            >
              {isCopied ? <Check className="w-3.5 h-3.5 text-[#1db954]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{isCopied ? 'Link Copied!' : 'Copy Guest Link'}</span>
            </button>
          </div>

          {/* Crowd Auto-Skip Meter */}
          <div className="p-3.5 rounded-2xl bg-[#181818] border border-[#282828] mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-neutral-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                <span>Downvotes: <strong>{currentDownvotes}</strong> / {effectiveGuests}</span>
              </span>
              <span className="text-neutral-500 font-mono">{currentDownvotePercent}% / {skipThresholdPercent}%</span>
            </div>
            <div className="w-full bg-[#282828] rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  currentDownvotePercent >= skipThresholdPercent ? 'bg-rose-500' : 'bg-[#1db954]'
                }`}
                style={{ width: `${Math.min(100, (currentDownvotePercent / skipThresholdPercent) * 100)}%` }}
              />
            </div>
          </div>

          {/* Live Top Upcoming Queue */}
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-xs uppercase font-extrabold tracking-wider text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-party-purple" />
                <span>Live Queue ({queue.length})</span>
              </h3>
              <span className="text-[10px] text-neutral-500">Auto-Sorted</span>
            </div>

            <div className="space-y-2 flex-1">
              {queue.slice(0, 5).map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-xl bg-[#181818] border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-center space-x-2.5 min-w-0 flex-1 mr-2">
                    <span className="text-xs font-mono font-bold text-neutral-500 w-4 text-center">
                      #{index + 1}
                    </span>
                    <img
                      src={item.album_art_url}
                      alt={item.track_name}
                      className="w-9 h-9 rounded-lg object-cover bg-black shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{item.track_name}</p>
                      <p className="text-[10px] text-neutral-400 truncate">@{item.requested_by_name}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md ${
                      item.score > 0
                        ? 'bg-[#1db954]/20 text-[#1db954]'
                        : item.score < 0
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {item.score > 0 ? `+${item.score}` : item.score}
                  </span>
                </div>
              ))}

              {queue.length === 0 && (
                <div className="p-6 text-center text-xs text-neutral-500">
                  Queue is empty. Select a song or scan the QR code to vote!
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* 4. BOTTOM BAR: Authentic Spotify Web Player Bar */}
      <footer className="h-24 bg-[#181818] border-t border-[#282828] px-4 flex items-center justify-between relative z-20 shrink-0">
        {/* Left: Track Information */}
        <div className="flex items-center space-x-3.5 w-1/4 min-w-[200px]">
          {currentPlaying ? (
            <>
              <img
                src={currentPlaying.album_art_url}
                alt={currentPlaying.track_name}
                className="w-14 h-14 rounded-lg object-cover bg-black shadow-lg shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate hover:underline cursor-pointer">
                  {currentPlaying.track_name}
                </p>
                <p className="text-xs text-neutral-400 truncate hover:underline cursor-pointer">
                  {currentPlaying.artist_name}
                </p>
                <span className="text-[10px] text-[#1db954] block truncate">
                  req. by @{currentPlaying.requested_by_name}
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-neutral-400">
              <span className="font-semibold text-white">No Track Playing</span>
              <p className="text-[10px] text-neutral-500">Select any song to start the party</p>
            </div>
          )}
        </div>

        {/* Center: Playback Controls & Progress Bar */}
        <div className="flex flex-col items-center max-w-xl w-2/4">
          <div className="flex items-center space-x-5 mb-1.5">
            <button
              onClick={() => handleAdvanceTrack('skip')}
              className="text-neutral-400 hover:text-white transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            {/* Main Play / Pause Button */}
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white hover:scale-105 active:scale-95 text-black flex items-center justify-center transition-all shadow-md"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            {/* Host Veto Button */}
            <button
              onClick={() => handleAdvanceTrack('veto')}
              className="text-neutral-400 hover:text-rose-400 transition-colors"
              title="Host Veto: Skip unwanted track"
            >
              <Ban className="w-4 h-4" />
            </button>
          </div>

          {/* Scrubber Progress Bar */}
          <div className="w-full flex items-center space-x-2 text-[11px] font-mono text-neutral-400">
            <span>{formatDuration(progressMs)}</span>
            <div className="flex-1 bg-[#4d4d4d] h-1 rounded-full overflow-hidden cursor-pointer group">
              <div
                className="bg-white group-hover:bg-[#1db954] h-full rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span>{formatDuration(effectiveDuration)}</span>
          </div>
        </div>

        {/* Right: Volume & Display Controls */}
        <div className="flex items-center justify-end space-x-3.5 w-1/4 min-w-[200px]">
          {currentPlaying?.track_uri && (
            <a
              href={`https://open.spotify.com/track/${currentPlaying.track_uri.replace('spotify:track:', '')}`}
              target="_blank"
              rel="noreferrer"
              className="text-neutral-400 hover:text-[#1db954] transition-colors p-1"
              title="Open Track in Spotify App"
            >
              <Share2 className="w-4 h-4" />
            </a>
          )}

          <span className="text-[11px] text-neutral-400 hidden sm:inline-block">
            {isSimulated ? 'Browser Player' : 'Spotify Connect'}
          </span>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value));
                setIsMuted(false);
              }}
              className="w-20 h-1 accent-[#1db954] cursor-pointer"
            />
          </div>

          <button
            onClick={toggleFullscreen}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Toggle TV Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </footer>

      {/* Expanded QR Code Modal for TV */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="p-8 bg-[#181818] border border-[#282828] rounded-3xl max-w-md w-full flex flex-col items-center text-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-black text-white mb-1">Scan with Phone Camera</h3>
            <p className="text-xs text-neutral-400 mb-6">Vote on songs &amp; request tracks from your phone</p>
            <div className="p-4 bg-white rounded-2xl shadow-2xl mb-6">
              <QRCodeSVG value={joinUrl} size={260} level="H" />
            </div>
            <div className="font-mono text-3xl font-black tracking-widest text-[#1db954] mb-2">
              {safeRoomCode}
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
    </div>
  );
}
