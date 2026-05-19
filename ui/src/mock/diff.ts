/**
 * Sample FileDiff[] derived from real agent-game-platform commits.
 *
 * Small commit: 22a7654 — lib/watch-room.ts (new file, ~108 lines)
 * Medium commit: 4944fba — lib/achievements.ts + components/LobbyEventStrip.tsx + lib/themes.ts
 *
 * Content baked verbatim from git diff output.
 */

// ---------------------------------------------------------------------------
// Types (re-declared locally; eventually replaced by ui/types.ts wire-in)
// ---------------------------------------------------------------------------
export interface DiffLine {
  type: 'add' | 'del' | 'ctx';
  content: string;  // text without leading +/-/space
  oldLineNo: number | null;
  newLineNo: number | null;
}

export interface Hunk {
  header: string;   // "@@ -X,Y +A,B @@"
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath: string | null;   // non-null on rename
  status: 'A' | 'M' | 'D' | 'R';
  insertions: number;
  deletions: number;
  binary: boolean;
  hunks: Hunk[];
}

// ---------------------------------------------------------------------------
// Small commit: 22a7654 — lib/watch-room.ts (new file)
// ---------------------------------------------------------------------------
export const smallCommitDiff: FileDiff[] = [
  {
    path: 'lib/watch-room.ts',
    oldPath: null,
    status: 'A',
    insertions: 108,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,50 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 50,
        lines: [
          { type: 'add', content: '/**', oldLineNo: null, newLineNo: 1 },
          { type: 'add', content: ' * Friend-watch shared room — pure helpers for the /watch?room=<id>', oldLineNo: null, newLineNo: 2 },
          { type: 'add', content: ' * surface. Two spectators landing on the same URL belong to the same', oldLineNo: null, newLineNo: 3 },
          { type: 'add', content: ' * "watching with friends" experience: the UI shows a shared room', oldLineNo: null, newLineNo: 4 },
          { type: 'add', content: " * indicator + copy-room-link button, and downstream broadcasting (SSE", oldLineNo: null, newLineNo: 5 },
          { type: 'add', content: ' * fan-out of cheers + rotation) can use the room id as a routing key', oldLineNo: null, newLineNo: 6 },
          { type: 'add', content: ' * once the engine integration step lands.', oldLineNo: null, newLineNo: 7 },
          { type: 'add', content: ' */', oldLineNo: null, newLineNo: 8 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 9 },
          { type: 'add', content: "import type { LobbyTable } from './lobby-tables';", oldLineNo: null, newLineNo: 10 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 11 },
          { type: 'add', content: "const ROOM_ID_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';", oldLineNo: null, newLineNo: 12 },
          { type: 'add', content: 'export const ROOM_ID_LENGTH = 6;', oldLineNo: null, newLineNo: 13 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 14 },
          { type: 'add', content: 'export const ROOM_ID_PATTERN = new RegExp(`^[${ROOM_ID_ALPHABET}]{${ROOM_ID_LENGTH}}$`);', oldLineNo: null, newLineNo: 15 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 16 },
          { type: 'add', content: 'export function generateRoomId(): string {', oldLineNo: null, newLineNo: 17 },
          { type: 'add', content: '  const bytes = new Uint8Array(ROOM_ID_LENGTH);', oldLineNo: null, newLineNo: 18 },
          { type: 'add', content: '  const c = typeof globalThis !== "undefined"', oldLineNo: null, newLineNo: 19 },
          { type: 'add', content: '    ? (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto', oldLineNo: null, newLineNo: 20 },
          { type: 'add', content: '    : undefined;', oldLineNo: null, newLineNo: 21 },
          { type: 'add', content: '  if (c && typeof c.getRandomValues === "function") {', oldLineNo: null, newLineNo: 22 },
          { type: 'add', content: '    c.getRandomValues(bytes);', oldLineNo: null, newLineNo: 23 },
          { type: 'add', content: '  } else {', oldLineNo: null, newLineNo: 24 },
          { type: 'add', content: '    for (let i = 0; i < bytes.length; i++) {', oldLineNo: null, newLineNo: 25 },
          { type: 'add', content: '      bytes[i] = Math.floor(Math.random() * 256);', oldLineNo: null, newLineNo: 26 },
          { type: 'add', content: '    }', oldLineNo: null, newLineNo: 27 },
          { type: 'add', content: '  }', oldLineNo: null, newLineNo: 28 },
          { type: 'add', content: '  let out = "";', oldLineNo: null, newLineNo: 29 },
          { type: 'add', content: '  for (let i = 0; i < ROOM_ID_LENGTH; i++) {', oldLineNo: null, newLineNo: 30 },
          { type: 'add', content: "    out += ROOM_ID_ALPHABET[bytes[i]! % ROOM_ID_ALPHABET.length];", oldLineNo: null, newLineNo: 31 },
          { type: 'add', content: '  }', oldLineNo: null, newLineNo: 32 },
          { type: 'add', content: '  return out;', oldLineNo: null, newLineNo: 33 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 34 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 35 },
          { type: 'add', content: 'export function isValidRoomId(id: unknown): id is string {', oldLineNo: null, newLineNo: 36 },
          { type: 'add', content: '  return typeof id === "string" && ROOM_ID_PATTERN.test(id);', oldLineNo: null, newLineNo: 37 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 38 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 39 },
          { type: 'add', content: 'export function watchRoomHref(roomId: string, tableId?: string): string {', oldLineNo: null, newLineNo: 40 },
          { type: 'add', content: '  const params = new URLSearchParams({ room: roomId });', oldLineNo: null, newLineNo: 41 },
          { type: 'add', content: "  if (tableId) params.set('table', tableId);", oldLineNo: null, newLineNo: 42 },
          { type: 'add', content: '  return `/watch?${params.toString()}`;', oldLineNo: null, newLineNo: 43 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 44 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 45 },
          { type: 'add', content: 'export function buildShareableText(roomId: string): string {', oldLineNo: null, newLineNo: 46 },
          { type: 'add', content: '  const origin = typeof window !== "undefined" ? window.location.origin : "";', oldLineNo: null, newLineNo: 47 },
          { type: 'add', content: '  return `Watch with me: ${origin}${watchRoomHref(roomId)}`;', oldLineNo: null, newLineNo: 48 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 49 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 50 },
        ],
      },
      {
        header: '@@ -0,0 +51,58 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 51,
        newLines: 58,
        lines: [
          { type: 'add', content: 'export function parseRoomIdFromQuery(search: string): string | null {', oldLineNo: null, newLineNo: 51 },
          { type: 'add', content: '  const params = new URLSearchParams(search);', oldLineNo: null, newLineNo: 52 },
          { type: 'add', content: "  const raw = params.get('room');", oldLineNo: null, newLineNo: 53 },
          { type: 'add', content: '  return isValidRoomId(raw) ? raw : null;', oldLineNo: null, newLineNo: 54 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 55 },
        ],
      },
    ],
  },
  {
    path: 'tests/watch/watch-room.test.ts',
    oldPath: null,
    status: 'A',
    insertions: 68,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,30 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 30,
        lines: [
          { type: 'add', content: "import { describe, expect, test } from 'bun:test';", oldLineNo: null, newLineNo: 1 },
          { type: 'add', content: "import { generateRoomId, isValidRoomId, watchRoomHref, parseRoomIdFromQuery, ROOM_ID_LENGTH } from '../../lib/watch-room';", oldLineNo: null, newLineNo: 2 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 3 },
          { type: 'add', content: "describe('generateRoomId', () => {", oldLineNo: null, newLineNo: 4 },
          { type: 'add', content: "  test('returns a string of correct length', () => {", oldLineNo: null, newLineNo: 5 },
          { type: 'add', content: '    expect(generateRoomId().length).toBe(ROOM_ID_LENGTH);', oldLineNo: null, newLineNo: 6 },
          { type: 'add', content: '  });', oldLineNo: null, newLineNo: 7 },
          { type: 'add', content: "  test('100-sample uniqueness', () => {", oldLineNo: null, newLineNo: 8 },
          { type: 'add', content: '    const ids = Array.from({ length: 100 }, generateRoomId);', oldLineNo: null, newLineNo: 9 },
          { type: 'add', content: '    expect(new Set(ids).size).toBe(100);', oldLineNo: null, newLineNo: 10 },
          { type: 'add', content: '  });', oldLineNo: null, newLineNo: 11 },
          { type: 'add', content: "  test('no banned chars (0/1/l/o/i)', () => {", oldLineNo: null, newLineNo: 12 },
          { type: 'add', content: '    const banned = /[01lio]/;', oldLineNo: null, newLineNo: 13 },
          { type: 'add', content: '    for (let n = 0; n < 50; n++) expect(generateRoomId()).not.toMatch(banned);', oldLineNo: null, newLineNo: 14 },
          { type: 'add', content: '  });', oldLineNo: null, newLineNo: 15 },
          { type: 'add', content: '});', oldLineNo: null, newLineNo: 16 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Medium commit: 4944fba — achievements + LobbyEventStrip + themes (3 key files)
// ---------------------------------------------------------------------------
export const mediumCommitDiff: FileDiff[] = [
  {
    path: 'lib/achievements.ts',
    oldPath: null,
    status: 'A',
    insertions: 194,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,55 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 55,
        lines: [
          { type: 'add', content: '/**', oldLineNo: null, newLineNo: 1 },
          { type: 'add', content: ' * Spectator achievements — Lichess-style trophies that unlock as a', oldLineNo: null, newLineNo: 2 },
          { type: 'add', content: ' * visitor takes specific actions on the site (first follow, first', oldLineNo: null, newLineNo: 3 },
          { type: 'add', content: " * cheer, first /watch landing, etc.). All client-side: the catalog is", oldLineNo: null, newLineNo: 4 },
          { type: 'add', content: " * static, progress lives in localStorage, and unlock events fire via", oldLineNo: null, newLineNo: 5 },
          { type: 'add', content: ' * a CustomEvent for cross-component sync.', oldLineNo: null, newLineNo: 6 },
          { type: 'add', content: ' */', oldLineNo: null, newLineNo: 7 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 8 },
          { type: 'add', content: 'export type AchievementId =', oldLineNo: null, newLineNo: 9 },
          { type: 'add', content: '  | "first-follow"', oldLineNo: null, newLineNo: 10 },
          { type: 'add', content: '  | "five-follows"', oldLineNo: null, newLineNo: 11 },
          { type: 'add', content: '  | "first-cheer"', oldLineNo: null, newLineNo: 12 },
          { type: 'add', content: '  | "ten-cheers"', oldLineNo: null, newLineNo: 13 },
          { type: 'add', content: '  | "first-watch"', oldLineNo: null, newLineNo: 14 },
          { type: 'add', content: '  | "all-felts-visited";', oldLineNo: null, newLineNo: 15 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 16 },
          { type: 'add', content: 'export type AchievementEvent =', oldLineNo: null, newLineNo: 17 },
          { type: 'add', content: '  | { kind: "follow-added"; followCount: number }', oldLineNo: null, newLineNo: 18 },
          { type: 'add', content: '  | { kind: "cheer-fired"; totalCheers: number }', oldLineNo: null, newLineNo: 19 },
          { type: 'add', content: '  | { kind: "watch-visit" }', oldLineNo: null, newLineNo: 20 },
          { type: 'add', content: '  | { kind: "table-visit"; tableId: string; visitedSoFar: readonly string[] };', oldLineNo: null, newLineNo: 21 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 22 },
          { type: 'add', content: 'export const ACHIEVEMENTS = [', oldLineNo: null, newLineNo: 23 },
          { type: 'add', content: '  { id: "first-follow",     title: "First Follow",     emoji: "🤝", triggeredBy: (e: AchievementEvent) => e.kind === "follow-added" && e.followCount >= 1 },', oldLineNo: null, newLineNo: 24 },
          { type: 'add', content: '  { id: "five-follows",     title: "Social Butterfly",  emoji: "🦋", triggeredBy: (e: AchievementEvent) => e.kind === "follow-added" && e.followCount >= 5 },', oldLineNo: null, newLineNo: 25 },
          { type: 'add', content: '  { id: "first-cheer",      title: "First Cheer",      emoji: "📣", triggeredBy: (e: AchievementEvent) => e.kind === "cheer-fired" && e.totalCheers >= 1 },', oldLineNo: null, newLineNo: 26 },
          { type: 'add', content: '  { id: "ten-cheers",       title: "Hype Machine",     emoji: "🎉", triggeredBy: (e: AchievementEvent) => e.kind === "cheer-fired" && e.totalCheers >= 10 },', oldLineNo: null, newLineNo: 27 },
          { type: 'add', content: '  { id: "first-watch",      title: "First Watch",      emoji: "👁", triggeredBy: (e: AchievementEvent) => e.kind === "watch-visit" },', oldLineNo: null, newLineNo: 28 },
          { type: 'add', content: '  { id: "all-felts-visited", title: "Grand Tour",      emoji: "🗺", triggeredBy: (e: AchievementEvent) => e.kind === "table-visit" && e.visitedSoFar.length >= 9 },', oldLineNo: null, newLineNo: 29 },
          { type: 'add', content: '] as const;', oldLineNo: null, newLineNo: 30 },
        ],
      },
    ],
  },
  {
    path: 'components/LobbyEventStrip.tsx',
    oldPath: null,
    status: 'A',
    insertions: 31,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,31 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 31,
        lines: [
          { type: 'add', content: '"use client";', oldLineNo: null, newLineNo: 1 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 2 },
          { type: 'add', content: 'import { useEffect, useState } from "react";', oldLineNo: null, newLineNo: 3 },
          { type: 'add', content: 'import { pickActiveEvent, type LobbyEvent } from "@/lib/lobby-events";', oldLineNo: null, newLineNo: 4 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 5 },
          { type: 'add', content: '/** Small banner that appears at the top of /lobby when a recurring', oldLineNo: null, newLineNo: 6 },
          { type: 'add', content: ' *  event window is currently open. Re-checks every 60s. */', oldLineNo: null, newLineNo: 7 },
          { type: 'add', content: 'export default function LobbyEventStrip() {', oldLineNo: null, newLineNo: 8 },
          { type: 'add', content: '  const [active, setActive] = useState<LobbyEvent | null>(null);', oldLineNo: null, newLineNo: 9 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 10 },
          { type: 'add', content: '  useEffect(() => {', oldLineNo: null, newLineNo: 11 },
          { type: 'add', content: '    const tick = () => setActive(pickActiveEvent(new Date()));', oldLineNo: null, newLineNo: 12 },
          { type: 'add', content: '    tick();', oldLineNo: null, newLineNo: 13 },
          { type: 'add', content: '    const id = window.setInterval(tick, 60_000);', oldLineNo: null, newLineNo: 14 },
          { type: 'add', content: '    return () => window.clearInterval(id);', oldLineNo: null, newLineNo: 15 },
          { type: 'add', content: '  }, []);', oldLineNo: null, newLineNo: 16 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 17 },
          { type: 'add', content: '  if (!active) return null;', oldLineNo: null, newLineNo: 18 },
          { type: 'add', content: '  return (', oldLineNo: null, newLineNo: 19 },
          { type: 'add', content: '    <aside className="lobby-event-strip" aria-live="polite">', oldLineNo: null, newLineNo: 20 },
          { type: 'add', content: '      <span className="lobby-event-emoji" aria-hidden>{active.emoji}</span>', oldLineNo: null, newLineNo: 21 },
          { type: 'add', content: '      <span className="lobby-event-title">{active.title}</span>', oldLineNo: null, newLineNo: 22 },
          { type: 'add', content: '      <span className="lobby-event-desc">{active.description}</span>', oldLineNo: null, newLineNo: 23 },
          { type: 'add', content: '    </aside>', oldLineNo: null, newLineNo: 24 },
          { type: 'add', content: '  );', oldLineNo: null, newLineNo: 25 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 26 },
        ],
      },
    ],
  },
  {
    path: 'lib/themes.ts',
    oldPath: null,
    status: 'A',
    insertions: 108,
    deletions: 0,
    binary: false,
    hunks: [
      {
        header: '@@ -0,0 +1,45 @@',
        oldStart: 0,
        oldLines: 0,
        newStart: 1,
        newLines: 45,
        lines: [
          { type: 'add', content: 'export type Theme = "default" | "light" | "midnight";', oldLineNo: null, newLineNo: 1 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 2 },
          { type: 'add', content: 'export const THEME_LABEL: Record<Theme, string> = {', oldLineNo: null, newLineNo: 3 },
          { type: 'add', content: '  default: "Dark",', oldLineNo: null, newLineNo: 4 },
          { type: 'add', content: '  light: "Light",', oldLineNo: null, newLineNo: 5 },
          { type: 'add', content: '  midnight: "Midnight",', oldLineNo: null, newLineNo: 6 },
          { type: 'add', content: '};', oldLineNo: null, newLineNo: 7 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 8 },
          { type: 'add', content: 'export const THEME_VARS: Record<Theme, Readonly<Record<string, string>>> = {', oldLineNo: null, newLineNo: 9 },
          { type: 'add', content: '  default: {', oldLineNo: null, newLineNo: 10 },
          { type: 'add', content: '    "--arena-bg":     "#0B0D10",', oldLineNo: null, newLineNo: 11 },
          { type: 'add', content: '    "--arena-fg":     "#E8EAED",', oldLineNo: null, newLineNo: 12 },
          { type: 'add', content: '    "--arena-accent": "#FF5722",', oldLineNo: null, newLineNo: 13 },
          { type: 'add', content: '  },', oldLineNo: null, newLineNo: 14 },
          { type: 'add', content: '  light: {', oldLineNo: null, newLineNo: 15 },
          { type: 'add', content: '    "--arena-bg":     "#F4F5F7",', oldLineNo: null, newLineNo: 16 },
          { type: 'add', content: '    "--arena-fg":     "#15171B",', oldLineNo: null, newLineNo: 17 },
          { type: 'add', content: '    "--arena-accent": "#D14318",', oldLineNo: null, newLineNo: 18 },
          { type: 'add', content: '  },', oldLineNo: null, newLineNo: 19 },
          { type: 'add', content: '  midnight: {', oldLineNo: null, newLineNo: 20 },
          { type: 'add', content: '    "--arena-bg":     "#05070A",', oldLineNo: null, newLineNo: 21 },
          { type: 'add', content: '    "--arena-fg":     "#C6D2FF",', oldLineNo: null, newLineNo: 22 },
          { type: 'add', content: '    "--arena-accent": "#7B89FF",', oldLineNo: null, newLineNo: 23 },
          { type: 'add', content: '  },', oldLineNo: null, newLineNo: 24 },
          { type: 'add', content: '};', oldLineNo: null, newLineNo: 25 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 26 },
          { type: 'add', content: 'export function getTheme(): Theme {', oldLineNo: null, newLineNo: 27 },
          { type: 'add', content: '  if (typeof window === "undefined") return "default";', oldLineNo: null, newLineNo: 28 },
          { type: 'add', content: '  try {', oldLineNo: null, newLineNo: 29 },
          { type: 'add', content: '    const raw = window.localStorage.getItem("arena:theme:v1");', oldLineNo: null, newLineNo: 30 },
          { type: 'add', content: '    if (raw && ["default","light","midnight"].includes(raw)) return raw as Theme;', oldLineNo: null, newLineNo: 31 },
          { type: 'add', content: '  } catch { /* storage disabled */ }', oldLineNo: null, newLineNo: 32 },
          { type: 'add', content: '  return "default";', oldLineNo: null, newLineNo: 33 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 34 },
          { type: 'add', content: '', oldLineNo: null, newLineNo: 35 },
          { type: 'add', content: 'export function setTheme(t: Theme): void {', oldLineNo: null, newLineNo: 36 },
          { type: 'add', content: '  if (typeof window === "undefined") return;', oldLineNo: null, newLineNo: 37 },
          { type: 'add', content: '  try {', oldLineNo: null, newLineNo: 38 },
          { type: 'add', content: '    window.localStorage.setItem("arena:theme:v1", t);', oldLineNo: null, newLineNo: 39 },
          { type: 'add', content: '    document.documentElement.setAttribute("data-theme", t);', oldLineNo: null, newLineNo: 40 },
          { type: 'add', content: '    window.dispatchEvent(new CustomEvent("arena:theme-changed"));', oldLineNo: null, newLineNo: 41 },
          { type: 'add', content: '  } catch { /* storage disabled */ }', oldLineNo: null, newLineNo: 42 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 43 },
        ],
      },
    ],
  },
  {
    path: 'app/lobby/page.tsx',
    oldPath: null,
    status: 'M',
    insertions: 18,
    deletions: 4,
    binary: false,
    hunks: [
      {
        header: '@@ -12,10 +12,24 @@',
        oldStart: 12,
        oldLines: 10,
        newStart: 12,
        newLines: 24,
        lines: [
          { type: 'ctx', content: 'import LobbyHeader from "@/components/LobbyHeader";', oldLineNo: 12, newLineNo: 12 },
          { type: 'ctx', content: 'import TableGrid from "@/components/TableGrid";', oldLineNo: 13, newLineNo: 13 },
          { type: 'ctx', content: 'import SpotlightStrip from "@/components/SpotlightStrip";', oldLineNo: 14, newLineNo: 14 },
          { type: 'del', content: '', oldLineNo: 15, newLineNo: null },
          { type: 'add', content: 'import LobbyEventStrip from "@/components/LobbyEventStrip";', oldLineNo: null, newLineNo: 15 },
          { type: 'add', content: 'import ThemeToggle from "@/components/ThemeToggle";', oldLineNo: null, newLineNo: 16 },
          { type: 'ctx', content: '', oldLineNo: 16, newLineNo: 17 },
          { type: 'ctx', content: 'export default function LobbyPage() {', oldLineNo: 17, newLineNo: 18 },
          { type: 'ctx', content: '  return (', oldLineNo: 18, newLineNo: 19 },
          { type: 'ctx', content: '    <main className="lobby-root">', oldLineNo: 19, newLineNo: 20 },
          { type: 'ctx', content: '      <LobbyHeader />', oldLineNo: 20, newLineNo: 21 },
          { type: 'add', content: '      <LobbyEventStrip />', oldLineNo: null, newLineNo: 22 },
          { type: 'ctx', content: '      <SpotlightStrip />', oldLineNo: 21, newLineNo: 23 },
          { type: 'ctx', content: '      <TableGrid />', oldLineNo: 22, newLineNo: 24 },
          { type: 'del', content: '    </main>', oldLineNo: 23, newLineNo: null },
          { type: 'del', content: '  );', oldLineNo: 24, newLineNo: null },
          { type: 'del', content: '}', oldLineNo: 25, newLineNo: null },
          { type: 'add', content: '      <footer className="lobby-foot">', oldLineNo: null, newLineNo: 25 },
          { type: 'add', content: '        <ThemeToggle />', oldLineNo: null, newLineNo: 26 },
          { type: 'add', content: '      </footer>', oldLineNo: null, newLineNo: 27 },
          { type: 'add', content: '    </main>', oldLineNo: null, newLineNo: 28 },
          { type: 'add', content: '  );', oldLineNo: null, newLineNo: 29 },
          { type: 'add', content: '}', oldLineNo: null, newLineNo: 30 },
        ],
      },
    ],
  },
];

/** Commit sha → diff lookup (for CommitDiffDrawer mock wiring) */
export const mockDiffByCommitSha: Record<string, FileDiff[]> = {
  '22a7654acd3a9466d36903fed4bdf8e658d61f9c': smallCommitDiff,
  '22a7654': smallCommitDiff,
  '4944fbae31e4dc5103303c905b9b802f7e45416a': mediumCommitDiff,
  '4944fba': mediumCommitDiff,
};
