'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SpotifyTrack } from '@/types/database';
import { formatDuration } from '@/lib/utils';
import { Search, X, Music, Plus, Check, AlertCircle, Loader2 } from 'lucide-react';
import { INITIAL_MOCK_TRACKS } from '@/lib/mock-data';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  guestName: string;
  isLimitReached: boolean;
  maxRequests: number;
  userRequestsCount: number;
  onAddTrack: (track: SpotifyTrack, guestName: string) => Promise<any>;
}

export function SearchModal({
  isOpen,
  onClose,
  roomCode,
  guestName,
  isLimitReached,
  maxRequests,
  userRequestsCount,
  onAddTrack,
}: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResults(INITIAL_MOCK_TRACKS.slice(0, 5)); // Initial suggested tracks
      setErrorMsg(null);
    } else {
      setQuery('');
      setAddedIds(new Set());
    }
  }, [isOpen]);

  // Debounced search query
  useEffect(() => {
    if (!query.trim()) {
      setResults(INITIAL_MOCK_TRACKS.slice(0, 5));
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(query)}&roomCode=${encodeURIComponent(roomCode)}`
        );
        const data = await res.json();
        if (data.tracks) {
          setResults(data.tracks);
        }
      } catch (err) {
        console.error('Search request error:', err);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [query, roomCode]);

  if (!isOpen) return null;

  const handleSelectTrack = async (track: SpotifyTrack) => {
    if (isLimitReached) {
      setErrorMsg(`You have reached the ${maxRequests}-song limit! Wait for one of your requests to finish.`);
      return;
    }

    try {
      setAddingId(track.id);
      setErrorMsg(null);
      await onAddTrack(track, guestName);
      setAddedIds((prev) => new Set(prev).add(track.id));
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to request track');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
          <div className="flex items-center space-x-2">
            <Music className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-white tracking-wide">Request a Track</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Request Limit Info Banner */}
        <div className="px-4 py-2 bg-neutral-950/70 border-b border-neutral-800/60 flex items-center justify-between text-xs">
          <span className="text-neutral-400">
            Requesting as <span className="font-semibold text-emerald-400">{guestName}</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-full font-medium ${
              isLimitReached
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {userRequestsCount} / {maxRequests} Songs Used
          </span>
        </div>

        {/* Error / Limit Alert */}
        {errorMsg && (
          <div className="mx-4 mt-3 p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center space-x-2 text-rose-200 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Search Input Bar */}
        <div className="p-4">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 w-5 h-5 text-neutral-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by song title or artist..."
              className="w-full bg-neutral-800/90 border border-neutral-700/80 rounded-xl pl-11 pr-10 py-3 text-white placeholder-neutral-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
            {loading && (
              <Loader2 className="absolute right-3.5 w-4 h-4 text-emerald-400 animate-spin" />
            )}
            {query && !loading && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3.5 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Results List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
          {!query && (
            <p className="text-xs uppercase font-semibold tracking-wider text-neutral-500 px-1 mb-2">
              Popular Party Tracks
            </p>
          )}

          {results.length === 0 && !loading && (
            <div className="text-center py-12 text-neutral-500">
              <Music className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tracks found for &quot;{query}&quot;</p>
              <p className="text-xs text-neutral-600 mt-1">Try searching another title or artist</p>
            </div>
          )}

          {results.map((track) => {
            const isAdded = addedIds.has(track.id);
            const isAdding = addingId === track.id;
            const albumArt = track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100';
            const artistNames = track.artists?.map((a) => a.name).join(', ') || 'Unknown Artist';

            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/40 hover:bg-neutral-800/90 border border-neutral-800/80 transition-all group"
              >
                <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
                  {/* Album Artwork */}
                  <img
                    src={albumArt}
                    alt={track.name}
                    className="w-12 h-12 rounded-lg object-cover bg-neutral-800 shrink-0 shadow-md"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {track.name}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {artistNames}
                    </p>
                    <span className="text-[10px] text-neutral-500">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </div>
                </div>

                {/* Add to Queue Button */}
                <button
                  onClick={() => handleSelectTrack(track)}
                  disabled={isLimitReached || isAdding || isAdded}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shrink-0 ${
                    isAdded
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : isLimitReached
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20 active:scale-95'
                  }`}
                >
                  {isAdding ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Added!</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add to Queue</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
