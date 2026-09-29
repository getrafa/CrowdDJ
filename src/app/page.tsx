'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { generateRoomCode } from '@/lib/utils';
import {
  Radio,
  Music,
  Users,
  Sparkles,
  ArrowRight,
  Sliders,
  Flame,
  ShieldCheck,
  QrCode,
  Play,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [skipThreshold, setSkipThreshold] = useState(60);
  const [maxRequests, setMaxRequests] = useState(3);
  const [showHostSettings, setShowHostSettings] = useState(false);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length >= 4) {
      router.push(`/join/${cleanCode}`);
    }
  };

  const handleHostParty = async (withSpotifyAuth = false) => {
    try {
      setIsCreating(true);
      const generatedCode = generateRoomCode();

      // Create room in database
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: generatedCode,
          skipThresholdPercent: skipThreshold,
          maxRequestsPerUser: maxRequests,
        }),
      });

      const data = await res.json();
      const code = data.room?.room_code || generatedCode;

      if (withSpotifyAuth) {
        // Redirect to Spotify OAuth
        window.location.href = `/api/auth/spotify/login?roomCode=${code}`;
      } else {
        // Direct launch into Host Deck
        router.push(`/host/${code}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-emerald-500 selection:text-black overflow-x-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-600/10 via-purple-600/5 to-transparent blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white">CrowdDJ</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] tracking-wider uppercase font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Jukebox
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => handleHostParty(false)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold transition-colors"
          >
            Instant Host Demo
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 pt-12 pb-20 text-center flex flex-col items-center">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-medium mb-8 shadow-xl">
          <Sparkles className="w-3.5 h-3.5 text-party-pink" />
          <span>The Democratic Collaborative Music App for Parties &amp; Venues</span>
        </div>

        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl leading-[1.08] mb-6">
          Turn your crowd into <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500">
            the ultimate party DJ.
          </span>
        </h1>

        <p className="text-neutral-400 text-base sm:text-lg max-w-2xl mb-12">
          Guests scan a QR code to request tracks and vote. Songs with high upvotes play next, and bad tracks get auto-skipped by popular vote.
        </p>

        {/* Action Grid: Host vs Join */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl mb-16 text-left">
          {/* Card 1: Join as Guest */}
          <div className="p-8 rounded-3xl bg-neutral-900/80 border border-white/10 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-party-purple mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Join a Room</h2>
              <p className="text-xs text-neutral-400 mb-6">
                Got a 4-letter room code from the host TV? Enter it below to start requesting &amp; voting.
              </p>
            </div>

            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE (e.g. ABCD)"
                maxLength={6}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-2xl px-4 py-3 text-center text-lg font-mono font-bold tracking-widest uppercase text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button
                type="submit"
                disabled={joinCode.trim().length < 4}
                className="w-full py-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-bold text-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-98"
              >
                <span>Enter Room</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Card 2: Host a Party */}
          <div className="p-8 rounded-3xl bg-neutral-900/80 border border-emerald-500/30 backdrop-blur-xl shadow-2xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                <Play className="w-6 h-6 fill-current" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Host on TV / Speakers</h2>
              <p className="text-xs text-neutral-400 mb-4">
                Launch the audio player and display view with live QR code for your guests.
              </p>

              {/* Host Settings Accordion */}
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => setShowHostSettings(!showHostSettings)}
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 font-medium"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{showHostSettings ? 'Hide Room Rules' : 'Customize Room Rules'}</span>
                </button>

                {showHostSettings && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3 text-xs animate-in fade-in">
                    <div>
                      <div className="flex justify-between text-neutral-300 mb-1">
                        <span>Auto-Skip Downvote Threshold:</span>
                        <strong className="text-emerald-400 font-mono">{skipThreshold}%</strong>
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        step="5"
                        value={skipThreshold}
                        onChange={(e) => setSkipThreshold(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-neutral-300 mb-1">
                        <span>Max Requests per Guest:</span>
                        <strong className="text-emerald-400 font-mono">{maxRequests} songs</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="1"
                        value={maxRequests}
                        onChange={(e) => setMaxRequests(Number(e.target.value))}
                        className="w-full accent-emerald-500 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => handleHostParty(true)}
                disabled={isCreating}
                className="w-full py-3.5 rounded-2xl bg-spotify-green hover:bg-[#1ed760] text-black font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-98"
              >
                <span>Connect with Spotify</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => handleHostParty(false)}
                disabled={isCreating}
                className="w-full py-2.5 rounded-2xl bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 text-xs font-semibold text-center transition-colors border border-white/5"
              >
                Launch Browser Player (Zero Setup Demo)
              </button>
            </div>
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl text-left border-t border-white/10 pt-12">
          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5">
            <QrCode className="w-6 h-6 text-emerald-400 mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Zero-Friction QR Join</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              No app downloads or guest accounts required. Scan from any iPhone or Android camera to start playing.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5">
            <Flame className="w-6 h-6 text-party-pink mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Democratic Auto-Skip</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              When enough party guests downvote a bad song, the jukebox automatically transitions to the next top crowd favorite.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-900/40 border border-white/5">
            <ShieldCheck className="w-6 h-6 text-party-purple mb-3" />
            <h3 className="text-sm font-bold text-white mb-1">Anti-Spam Request Limits</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Configurable 3-song queue limit per guest ensures equal turn-taking, keeping the party music fresh and varied.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-xs text-neutral-500">
        <p>CrowdDJ &bull; Built with Next.js App Router, Tailwind CSS, TypeScript, Supabase Realtime &amp; Spotify Web Playback SDK.</p>
      </footer>
    </div>
  );
}
