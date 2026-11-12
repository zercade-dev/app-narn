/**
 * In-app notification types shared between the server store and the frontend
 * notification UI. Two flavours share one table: free-text admin broadcasts
 * (`kind: null`, one row per addressee) and typed rows (`kind` set) that the
 * app writes for one user about their runs or their project's collaborators —
 * see the server's `PgNotificationStore` / module-level
 * `insertNotificationForUser`. Users can individually dismiss (delete) or mark
 * their own notifications read; a listing holds the newest 200 plus any older
 * unread ones (no pagination). Typed rows are pruned on insert (age and per-user count caps);
 * broadcasts are never pruned.
 */

import type { FailureCode, RunKind } from './runs.js';

/**
 * Notification urgency, set at creation time and never changed afterward.
 * - `info`     — routine/informational (the default).
 * - `warning`  — worth attention but not urgent.
 * - `critical` — requires prompt attention.
 */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

/**
 * What a typed notification is about. The UI renders title/body from `kind` +
 * `data`; the stored `title` is just the kind and `body` is empty.
 */
export type NotificationKind =
  'run-started' | 'run-finished' | 'run-finished-with-problems' | 'run-failed' | 'collab-digest';

/**
 * Kinds that report something the user should look at. "Mark informational
 * read" leaves these unread.
 */
export const PROBLEM_NOTIFICATION_KINDS = ['run-failed', 'run-finished-with-problems'] as const;

/** Payload of the `run-*` kinds. */
export interface RunNotificationData {
  runId: string;
  projectId: string;
  runKind: RunKind;
  total: number;
  completed: number;
  failed: number;
  targetLanguages: string[];
  causes: Array<{ code: FailureCode; count: number }>; // most common first, at most 3
}

/** Payload of the `collab-digest` kind: what collaborators did in a window. */
export interface CollabDigestData {
  projectId: string;
  since: string; // ISO 8601
  until: string; // ISO 8601
  collaborators: Array<{
    userId: string;
    name: string | null;
    edits: Array<{ language: string; count: number }>;
    translated: { count: number; languages: string[] };
  }>;
}

/**
 * One in-app notification row, scoped to the recipient user (RLS on
 * `notifications.user_id`). `createdAt`/`readAt` are the ISO-8601 rendering of
 * their `timestamptz` columns (mirrors the server's `BackupRecord.createdAt`);
 * `readAt` is `null` until the user marks it read. `broadcastId` groups the
 * fan-out rows produced by one admin broadcast — `null` for a row that wasn't
 * part of a broadcast (every typed row). `kind`/`data` are `null` on a
 * free-text broadcast and set on a typed row.
 */
export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  broadcastId: string | null;
  kind: NotificationKind | null; // null = free-text broadcast
  data: RunNotificationData | CollabDigestData | null;
  createdAt: string; // ISO 8601 (timestamptz → toISOString)
  readAt: string | null; // ISO 8601, or null while unread
}
