/**
 * In-app notification types shared between the server store and the frontend
 * notification UI. v1 is broadcast-only: an admin/ops action fans a
 * message out to every user, writing one row per addressee (no per-user
 * targeting yet) — see the server's `PgNotificationStore` / module-level
 * `insertNotificationForUser`. Users can individually dismiss (delete) or mark
 * their own notifications read; there is no retention/expiry job yet, so a
 * listing is capped to the newest 50 (no pagination).
 */

/**
 * Notification urgency, set at creation time and never changed afterward.
 * - `info`     — routine/informational (the default).
 * - `warning`  — worth attention but not urgent.
 * - `critical` — requires prompt attention.
 */
export type NotificationSeverity = 'info' | 'warning' | 'critical';

/**
 * One in-app notification row, scoped to the recipient user (RLS on
 * `notifications.user_id`). `createdAt`/`readAt` are the ISO-8601 rendering of
 * their `timestamptz` columns (mirrors the server's `BackupRecord.createdAt`);
 * `readAt` is `null` until the user marks it read. `broadcastId` groups the
 * fan-out rows produced by one admin broadcast — `null` for a row that wasn't
 * part of a broadcast (v1 only ever writes broadcasts, so today this is always
 * set, but the type stays honest about a future non-broadcast/targeted send).
 */
export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  body: string;
  severity: NotificationSeverity;
  broadcastId: string | null;
  createdAt: string; // ISO 8601 (timestamptz → toISOString)
  readAt: string | null; // ISO 8601, or null while unread
}
