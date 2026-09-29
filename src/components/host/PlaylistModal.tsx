'use client';

import React, { useState, useEffect } from 'react';
import { SpotifyTrack } from '@/types/database';
import { formatDuration } from '@/lib/utils';
import { X, ListMusic, Plus, Check, Loader2, ChevronRight, ArrowLeft, Play } from 'lucide-react';

interface Playlist {
  id: string;
  name: string;
  description: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
}

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  onAddTrack: (track: SpotifyTrack, requester: string) => Promise<any>;
}

export function PlaylistModal({
  isOpen,
  onClose,
  roomCode,
  onAddTrack,
}: PlaylistModalProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [queueingAll, setQueueingAll] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch host's Spotify playlists when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedPlaylist(null);
      setTracks([]);
      setErrorMsg(null);
      return;
    }

    const fetchPlaylists = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/spotify/playlists?roomCode=${encodeURIComponent(roomCode)}`);
        const data = await res.json();
        if (data.playlists) {
          setPlaylists(data.playlists);
        } else if (data.error) {
          setErrorMsg(data.error);
        }
      } catch (err: any) {
        setErrorMsg('Failed to load playlists');
      } finally {
        setLoading(false);
      }
    };

    fetchPlaylists();
  }, [isOpen, roomCode]);

  // Fetch tracks for selected playlist
  const handleSelectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setTracksLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(
        `/api/spotify/playlists/${playlist.id}?roomCode=${encodeURIComponent(roomCode)}`
      );
      const data = await res.json();
      if (data.tracks) {
        setTracks(data.tracks);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err) {
      setErrorMsg('Failed to load tracks from playlist');
    } finally {
      setTracksLoading(false);
    }
  };

  const handleAddSingle = async (track: SpotifyTrack) => {
    try {
      setAddingId(track.id);
      await onAddTrack(track, 'Host');
      setAddedIds((prev) => new Set(prev).add(track.id));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to add track');
    } finally {
      setAddingId(null);
    }
  };

  const handleQueueAll = async () => {
    if (!tracks.length) return;
    setQueueingAll(true);
    try {
      for (const track of tracks) {
        if (!addedIds.has(track.id)) {
          await onAddTrack(track, 'Host');
          setAddedIds((prev) => new Set(prev).add(track.id));
        }
      }
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error queueing playlist');
    } finally {
      setQueueingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in">
      <div
        className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center space-x-2.5">
            {selectedPlaylist ? (
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ListMusic className="w-4 h-4" />
              </div>
            )}
            <div>
              <h2 className="text-base font-bold text-white">
                {selectedPlaylist ? selectedPlaylist.name : 'Your Spotify Playlists'}
              </h2>
              <p className="text-xs text-neutral-400">
                {selectedPlaylist
                  ? `${selectedPlaylist.tracks.total} songs &bull; by ${selectedPlaylist.owner?.display_name || 'You'}`
                  : 'Select a playlist to queue party music'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Queue All Action Bar for Selected Playlist */}
        {selectedPlaylist && tracks.length > 0 && (
          <div className="px-5 py-3 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-xs text-neutral-300">
              Import all songs into CrowdDJ live queue
            </span>
            <button
              onClick={handleQueueAll}
              disabled={queueingAll}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center space-x-1.5 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              {queueingAll ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Queueing...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Queue All ({tracks.length})</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="p-3 mx-4 mt-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {loading && (
            <div className="py-20 text-center text-neutral-400 text-xs flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
              <span>Loading your Spotify playlists...</span>
            </div>
          )}

          {/* Playlist list view */}
          {!selectedPlaylist && !loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  onClick={() => handleSelectPlaylist(playlist)}
                  className="flex items-center p-3 rounded-2xl bg-neutral-800/40 hover:bg-neutral-800/90 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer group"
                >
                  <img
                    src={playlist.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100'}
                    alt={playlist.name}
                    className="w-14 h-14 rounded-xl object-cover bg-neutral-950 shadow-md shrink-0 mr-3"
                  />
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {playlist.name}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {playlist.tracks?.total || 0} songs
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-white shrink-0" />
                </div>
              ))}

              {playlists.length === 0 && !loading && (
                <div className="col-span-2 text-center py-16 text-neutral-500 text-xs">
                  No playlists found on your Spotify account.
                </div>
              )}
            </div>
          )}

          {/* Tracks list view */}
          {selectedPlaylist && (
            <>
              {tracksLoading && (
                <div className="py-20 text-center text-neutral-400 text-xs flex flex-col items-center">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-2" />
                  <span>Loading songs from &ldquo;{selectedPlaylist.name}&rdquo;...</span>
                </div>
              )}

              {!tracksLoading && (
                <div className="space-y-2">
                  {tracks.map((track) => {
                    const isAdded = addedIds.has(track.id);
                    const isAdding = addingId === track.id;
                    const albumArt = track.album?.images?.[0]?.url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100';
                    const artistNames = track.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';

                    return (
                      <div
                        key={track.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-800/40 hover:bg-neutral-800 border border-neutral-800/80 transition-all"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
                          <img
                            src={albumArt}
                            alt={track.name}
                            className="w-11 h-11 rounded-lg object-cover bg-neutral-950 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate">
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

                        <button
                          onClick={() => handleAddSingle(track)}
                          disabled={isAdded || isAdding}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1 transition-all shrink-0 ${
                            isAdded
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-md'
                          }`}
                        >
                          {isAdding ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : isAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Added</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
