'use client';

import React, { useState, useEffect } from 'react';
import { useRoomQueue } from '@/lib/hooks/useRoomQueue';
import { getOrCreateGuestSession, generateFunnyNickname, formatDuration } from '@/lib/utils';
import { SearchModal } from '@/components/guest/SearchModal';
import {
  ThumbsUp,
  ThumbsDown,
  Plus,
  Radio,
  Users,
  Music,
  Sparkles,
  Flame,
  Volume2,
  RefreshCw,
  Edit2,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuestViewProps {
  roomCode: string;
}

export function GuestView({ roomCode }: GuestViewProps) {
  const [guestSession, setGuestSession] = useState<{ id: string; name: string }>({
    id: '',
    name: '',
  });
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [toastMessage, setToMessage] = useState<string | null>(null);

  // Initialize guest session on mount
  useEffect(() => {
    const session = getOrCreateGuestSession();
    setGuestSession(session);
    setNameInput(session.name);
  }, []);

  const {
    room,
    queue,
    currentPlaying,
    activeGuests,
    userRequestsCount,
    maxRequests,
    isLimitReached,
    loading,
    castVote,
    addTrackToQueue,
    refreshQueue,
  } = useRoomQueue({
    roomCode,
    guestSessionId: guestSession.id,
  });

  const handleSaveName = (newName: string) => {
    const trimmed = newName.trim() || generateFunnyNickname();
    localStorage.setItem('crowddj_guest_name', trimmed);
    setGuestSession((prev) => ({ ...prev, name: trimmed }));
    setIsEditingName(false);
    showToast(`Display name set to ${trimmed}`);
  };

  const handleRandomizeName = () => {
    const fresh = generateFunnyNickname();
    setNameInput(fresh);
    handleSaveName(fresh);
  };

  const showToast = (msg: string) => {
    setToMessage(msg);
    setTimeout(() => setToMessage(null), 3000);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col pb-24 selection:bg-emerald-500 selection:text-black">
      {/* Top App Header */}
      <header className="sticky top-0 z-30 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              <span>CrowdDJ</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                {roomCode}
              </span>
            </h1>
            <p className="text-[11px] text-neutral-400 flex items-center gap-1">
              <Users className="w-3 h-3 text-neutral-500" />
              <span>{activeGuests} {activeGuests === 1 ? 'party guest' : 'party guests'} online</span>
            </p>
          </div>
        </div>

        {/* Guest Profile & Nickname Badge */}
        <div className="flex items-center space-x-2">
          {isEditingName ? (
            <div className="flex items-center space-x-1">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={20}
                className="bg-neutral-800 border border-neutral-700 text-xs px-2 py-1 rounded text-white w-28 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                onClick={() => handleSaveName(nameInput)}
                className="p-1 rounded bg-emerald-500 text-black hover:bg-emerald-400"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-neutral-800/80 border border-neutral-700/60 hover:border-neutral-600 text-xs text-neutral-300 transition-colors"
              title="Click to change your nickname"
            >
              <span className="text-emerald-400 font-medium">@{guestSession.name || 'Guest'}</span>
              <Edit2 className="w-2.5 h-2.5 opacity-50" />
            </button>
          )}

          <button
            onClick={refreshQueue}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Refresh queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sticky Mini "Now Playing" Bar */}
      {currentPlaying ? (
        <section className="sticky top-[57px] z-20 bg-gradient-to-r from-neutral-900 via-neutral-900/95 to-neutral-900 border-b border-emerald-500/30 px-4 py-2.5 backdrop-blur-md shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
              <div className="relative w-11 h-11 shrink-0 rounded-lg overflow-hidden shadow-md">
                <img
                  src={currentPlaying.album_art_url}
                  alt={currentPlaying.track_name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce-subtle" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                    Now Playing
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    req. by {currentPlaying.requested_by_name}
                  </span>
                </div>
                <p className="text-sm font-bold text-white truncate leading-tight">
                  {currentPlaying.track_name}
                </p>
                <p className="text-xs text-neutral-400 truncate">
                  {currentPlaying.artist_name}
                </p>
              </div>
            </div>

            {/* Quick Upvote/Downvote Actions for Current Track */}
            <div className="flex items-center space-x-1 bg-neutral-800/80 p-1 rounded-xl border border-neutral-700/60 shrink-0">
              <button
                onClick={() => castVote(currentPlaying.id, 1)}
                className={`p-1.5 rounded-lg transition-all ${
                  currentPlaying.userVote === 1
                    ? 'bg-emerald-500 text-black shadow-md'
                    : 'text-neutral-400 hover:text-emerald-400 hover:bg-neutral-700/50'
                }`}
                title="Upvote song"
              >
                <ThumbsUp className="w-4 h-4" />
              </button>
              <span
                className={`text-xs font-mono font-bold px-1 min-w-[20px] text-center ${
                  currentPlaying.score > 0
                    ? 'text-emerald-400'
                    : currentPlaying.score < 0
                    ? 'text-rose-400'
                    : 'text-neutral-400'
                }`}
              >
                {currentPlaying.score > 0 ? `+${currentPlaying.score}` : currentPlaying.score}
              </span>
              <button
                onClick={() => castVote(currentPlaying.id, -1)}
                className={`p-1.5 rounded-lg transition-all ${
                  currentPlaying.userVote === -1
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'text-neutral-400 hover:text-rose-400 hover:bg-neutral-700/50'
                }`}
                title="Downvote song (helps trigger auto-skip!)"
              >
                <ThumbsDown className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-neutral-900/60 border-b border-neutral-800 px-4 py-3 text-center">
          <p className="text-xs text-neutral-400">
            Jukebox is quiet. Tap <span className="text-emerald-400 font-semibold">&ldquo;Request Track&rdquo;</span> to start the party!
          </p>
        </section>
      )}

      {/* Main Content: Live Queue List */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4">
        {/* Request Limit Info Banner */}
        <div className="mb-4 p-3 rounded-2xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <Flame className="w-4 h-4 text-party-pink" />
            <span className="text-neutral-300 font-medium">Your Requests:</span>
            <span
              className={`font-mono font-bold ${
                isLimitReached ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {userRequestsCount} / {maxRequests}
            </span>
          </div>
          <button
            onClick={handleRandomizeName}
            className="text-neutral-400 hover:text-neutral-200 text-[11px] underline"
          >
            Change Nickname
          </button>
        </div>

        {/* Section Heading */}
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-xs uppercase tracking-wider font-bold text-neutral-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-party-purple" />
            <span>Upcoming Queue ({queue.length})</span>
          </h2>
          <span className="text-[11px] text-neutral-500">Live Voted by Crowd</span>
        </div>

        {/* Empty State */}
        {queue.length === 0 && !loading && (
          <div className="text-center py-16 px-4 bg-neutral-900/40 rounded-3xl border border-neutral-800/80 mt-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3">
              <Music className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Queue is empty!</h3>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto mb-4">
              Be the hero of the party and queue up the next track before the music stops.
            </p>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              Add First Track
            </button>
          </div>
        )}

        {/* Live Queue Cards with Smooth Re-sorting Animations */}
        <div className="space-y-2.5">
          <AnimatePresence>
            {queue.map((item, index) => {
              const isUserRequester = item.guest_session_id === guestSession.id;

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                    isUserRequester
                      ? 'bg-neutral-900/90 border-emerald-500/30'
                      : 'bg-neutral-900/60 hover:bg-neutral-900/90 border-neutral-800/80'
                  }`}
                >
                  {/* Left: Position Rank & Album Art */}
                  <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
                    <span className="text-xs font-mono font-bold text-neutral-500 w-5 text-center">
                      #{index + 1}
                    </span>
                    <img
                      src={item.album_art_url}
                      alt={item.track_name}
                      className="w-12 h-12 rounded-xl object-cover bg-neutral-800 shadow-md shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">
                        {item.track_name}
                      </p>
                      <p className="text-xs text-neutral-400 truncate">
                        {item.artist_name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-neutral-500">
                          {formatDuration(item.duration_ms)}
                        </span>
                        <span className="text-[10px] text-neutral-600">•</span>
                        <span
                          className={`text-[10px] truncate ${
                            isUserRequester ? 'text-emerald-400 font-semibold' : 'text-neutral-500'
                          }`}
                        >
                          {isUserRequester ? 'You' : item.requested_by_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Vote Buttons & Real-Time Score */}
                  <div className="flex items-center space-x-1 bg-neutral-800/60 p-1 rounded-xl border border-neutral-700/50 shrink-0">
                    <button
                      onClick={() => castVote(item.id, 1)}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                        item.userVote === 1
                          ? 'bg-emerald-500 text-black shadow-md'
                          : 'text-neutral-400 hover:text-emerald-400 hover:bg-neutral-700/50'
                      }`}
                      title="Upvote song"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex flex-col items-center justify-center min-w-[24px] px-1">
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

                    <button
                      onClick={() => castVote(item.id, -1)}
                      className={`p-1.5 rounded-lg transition-all active:scale-90 ${
                        item.userVote === -1
                          ? 'bg-rose-500 text-white shadow-md'
                          : 'text-neutral-400 hover:text-rose-400 hover:bg-neutral-700/50'
                      }`}
                      title="Downvote song"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Action Button (FAB): Request a Song */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsSearchOpen(true)}
          className={`flex items-center space-x-2 px-5 py-3.5 rounded-full font-bold text-sm shadow-2xl transition-all active:scale-95 ${
            isLimitReached
              ? 'bg-neutral-800 border border-neutral-700 text-neutral-400 shadow-neutral-900/50'
              : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/30 hover:shadow-emerald-500/50'
          }`}
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
          <span>{isLimitReached ? 'Limit Reached (3/3)' : 'Request a Song'}</span>
        </button>
      </div>

      {/* Track Search Modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        roomCode={roomCode}
        guestName={guestSession.name}
        isLimitReached={isLimitReached}
        maxRequests={maxRequests}
        userRequestsCount={userRequestsCount}
        onAddTrack={addTrackToQueue}
      />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-full text-xs text-white shadow-xl flex items-center space-x-2"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
