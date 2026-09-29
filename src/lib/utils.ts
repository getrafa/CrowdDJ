import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // readable chars without ambiguous 0/O, 1/I
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const FUNNY_ADJECTIVES = [
  "Groovy", "Funky", "Electric", "Neon", "Cosmic", "Velvet", "Bouncy",
  "Turbo", "Hyper", "Golden", "Sonic", "Mega", "Jazzy", "Glitchy", "Savage"
];

const FUNNY_NOUNS = [
  "DJ", "Bassline", "Vinyl", "Beatmaker", "Dancer", "Raver", "Subwoofer",
  "Synth", "Groover", "Audiophile", "Drop", "Tempo", "Vibe", "Speaker"
];

export function generateFunnyNickname(): string {
  const adj = FUNNY_ADJECTIVES[Math.floor(Math.random() * FUNNY_ADJECTIVES.length)];
  const noun = FUNNY_NOUNS[Math.floor(Math.random() * FUNNY_NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj}${noun}${num}`;
}

export function formatDuration(ms: number): string {
  if (!ms || ms <= 0) return "0:00";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getOrCreateGuestSession(): { id: string; name: string } {
  if (typeof window === "undefined") {
    return { id: "guest-ssr", name: "GuestDJ" };
  }

  let sessionId = localStorage.getItem("crowddj_guest_session_id");
  let guestName = localStorage.getItem("crowddj_guest_name");

  if (!sessionId) {
    sessionId = "guest_" + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    localStorage.setItem("crowddj_guest_session_id", sessionId);
  }

  if (!guestName) {
    guestName = generateFunnyNickname();
    localStorage.setItem("crowddj_guest_name", guestName);
  }

  return { id: sessionId, name: guestName };
}
