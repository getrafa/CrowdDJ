# 🎧 CrowdDJ — Collaborative Real-Time Jukebox

**CrowdDJ** is a production-ready, real-time collaborative web application for house parties and venues. Built with **Next.js 15 (App Router)**, **Tailwind CSS**, **TypeScript**, **Supabase (Realtime + PostgreSQL)**, and the **Spotify Web Playback SDK**.

---

## ⚡ Concept & User Flows

1. **Host View (`/host/[roomCode]`)**:
   - The host opens the app on a TV or desktop browser connected to room speakers.
   - Logs in with Spotify to initialize the in-browser **Spotify Web Playback SDK**.
   - Displays a dynamic, high-resolution **QR code** for guests to scan.
   - Features a large **"Now Playing" hero visualizer** with album art, track details, elapsed progress bar, and "Requested by" badge.
   - Live sidebar showing top 5 upcoming tracks ranked in real-time by crowd votes.
   - Host player controls: **Play/Pause**, **Skip**, and **Host Veto** (instant purge of inappropriate songs).
   - Real-time guest presence counter and auto-skip warning meter.

2. **Guest Mobile View (`/join/[roomCode]`)**:
   - Zero-friction onboarding: Guests simply point their phone camera at the host's QR code.
   - Automatically receives a humorous nickname (e.g., `NeonRave42`, `GroovyDJ88`) with one-tap editing and a persistent `guest_session_id` stored in `localStorage`.
   - Sticky mini **"Now Playing"** header bar with instant Upvote/Downvote buttons.
   - Real-time queue list with live upvote/downvote scores and tap-to-vote triggers.
   - Instant search modal querying Spotify's Search API with debounced queries.
   - Anti-spam request limit: Configurable 3-song queue limit per guest session ID.

---

## 🏗️ Architecture & Core Mechanics

### 1. Real-Time Queue Ranking
- **Score Calculation**: `Score = Upvotes - Downvotes`.
- Whenever a guest casts or revokes a vote, a PostgreSQL trigger (`trg_update_score`) recalculates the queue item's score.
- Supabase Realtime subscriptions (`postgres_changes` on `queue_items` and `votes`) push instant updates to all connected host and guest devices.
- The queue is sorted dynamically: highest score first, then earliest creation time.

### 2. Dynamic Democratic Auto-Skip Rule
- Calculated as:
  $$\frac{\text{Downvotes on Current Track}}{\text{Total Active Guests in Room}} \ge \frac{\text{Skip Threshold Percent}}{100}$$
- When this condition is satisfied, an automatic skip event fires to the host's Web Playback SDK, smoothly advancing to the next highest-voted song in the queue.

### 3. Track Transition Workflow
- When the host's Web Playback SDK fires `player_state_changed` showing the track finished, the current song transitions to `'played'`, the top-ranked item transitions to `'playing'`, and Spotify starts playing the new URI.

---

## 📁 Folder Structure

```
CrowdDJ/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/spotify/
│   │   │   │   ├── callback/route.ts  # Exchanges Spotify OAuth code & creates room
│   │   │   │   ├── login/route.ts     # Initiates Spotify OAuth flow
│   │   │   │   └── refresh/route.ts   # Refreshes expired access tokens
│   │   │   ├── rooms/
│   │   │   │   ├── create/route.ts    # Configures room rules & generates 4-letter code
│   │   │   │   └── [roomCode]/
│   │   │   │       ├── queue/route.ts # Queue fetch, add track (3-request limit), skip
│   │   │   │       ├── route.ts       # Room details & settings
│   │   │   │       └── vote/route.ts  # Casts votes & checks auto-skip threshold
│   │   │   └── spotify/
│   │   │       ├── playback/route.ts  # SDK Play, Pause, Transfer
│   │   │       └── search/route.ts    # Spotify track search
│   │   ├── host/[roomCode]/page.tsx   # Host / TV Display page
│   │   ├── join/[roomCode]/page.tsx   # Guest Mobile View page
│   │   ├── globals.css                # Tailwind styling & animations
│   │   ├── layout.tsx                 # Root layout
│   │   └── page.tsx                   # Landing page
│   ├── components/
│   │   ├── guest/
│   │   │   ├── GuestView.tsx          # Mobile guest jukebox interface
│   │   │   └── SearchModal.tsx        # Track search modal with 3-request limit
│   │   └── host/
│   │       ├── AmbientVisualizer.tsx  # Dynamic blurred album-art & pulsing background
│   │       └── HostDashboard.tsx      # Host TV display, Web Playback SDK, QR code
│   ├── lib/
│   │   ├── hooks/
│   │   │   ├── useRoomQueue.ts        # Supabase Realtime + BroadcastChannel hook
│   │   │   └── useSpotifyPlayer.ts    # Spotify Web Playback SDK controller
│   │   ├── spotify/
│   │   │   └── api.ts                 # Spotify API helper functions
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser Supabase client
│   │   │   └── server.ts              # Server Supabase client
│   │   ├── mock-data.ts               # Fallback mock tracks & demo queue
│   │   └── utils.ts                   # Nickname generator, code generator, formatters
│   └── types/
│       └── database.ts                # TypeScript interfaces for Rooms, Queue, Votes
├── supabase/
│   ├── migrations/
│   │   └── 20260929_init.sql          # Complete Supabase SQL migration script
│   └── schema.sql                     # Schema reference with RLS and triggers
├── .env.example
├── next.config.ts
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🗄️ Supabase Setup

1. Create a project in [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Paste and run the migration script located at [`supabase/migrations/20260929_init.sql`](supabase/migrations/20260929_init.sql).
4. Verify under **Database -> Publications** that `supabase_realtime` includes `rooms`, `queue_items`, and `votes`.
5. Copy your **Project URL**, **Anon Key**, and **Service Role Key** into your `.env.local` file.

---

## 🎵 Spotify Developer Setup

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and create an app.
2. In the app settings:
   - Set **Redirect URI** to: `http://localhost:3000/api/auth/spotify/callback` (or `https://your-domain.vercel.app/api/auth/spotify/callback`).
   - Which APIs are you using? Select **Web API** and **Web Playback SDK**.
3. Copy the **Client ID** and **Client Secret** into your `.env.local`.

---

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- Click **"Instant Host Demo"** to launch the Host TV Deck immediately.
- Open a second tab or phone at `http://localhost:3000/join/[roomCode]` to test real-time upvoting, downvoting, and song requesting!
