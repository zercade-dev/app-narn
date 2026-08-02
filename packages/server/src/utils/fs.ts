import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { logger } from '../modules/M15-console-logger.js';

/**
 * Atomically writes JSON data to a file using a temp-file-and-rename pattern.
 * Prevents partial writes from corrupting data files. The temp file carries a
 * unique UUID suffix so concurrent writers cannot clobber each other's temp
 * file; it still ends in `.tmp` so backup walks continue to skip it.
 *
 * Files are created owner-only (0600): the server persists single-user data —
 * including the credential vault — that no other account on the machine needs
 * to read. The mode applies because the temp file is always freshly created
 * and rename preserves it.
 */
export async function atomicWrite(filePath: string, data: unknown): Promise<void> {
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup so a failed write doesn't leak a stray temp file.
    await fs.unlink(tmpPath).catch(() => undefined);
    throw err;
  }
}

/**
 * Atomically writes a raw text payload via temp-file-and-rename, mirroring
 * {@link atomicWrite} but for an arbitrary string (the shared helper JSON-
 * stringifies its input, which would corrupt a CSV). Used for user-chosen
 * export paths so a crash mid-write can't leave a silently truncated file; no
 * 0600 mode here since an export is meant to be opened/shared by the user.
 */
export async function atomicWriteText(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmpPath, data, 'utf-8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup so a failed write doesn't leak a stray temp file.
    await fs.unlink(tmpPath).catch(() => undefined);
    throw err;
  }
}

/**
 * Reads and JSON-parses a file, returning `fallback` when the file is missing
 * (ENOENT) or its contents cannot be parsed. The single tolerant read path
 * shared by the storage modules, which all treat a missing/corrupt data file as
 * "start empty" rather than a fatal error.
 *
 * A missing file is the expected cold-start case and stays quiet; a parse
 * failure (corruption) on an existing file — or any other unexpected read error
 * — is logged at warn level so a silently dropped data file is at least
 * traceable. The parsed value is returned as `T` without validation; callers
 * that need schema validation must do so after this returns.
 */
export async function readJsonOr<T>(filePath: string, fallback: T): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException | null)?.code !== 'ENOENT') {
      logger.warn('readJsonOr: unexpected error reading file', {
        filePath,
        error: err instanceof Error ? err.message : String(err),
        code: (err as NodeJS.ErrnoException | null)?.code,
      });
    }
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn('readJsonOr: ignoring corrupt JSON file', {
      filePath,
      error: err instanceof Error ? err.message : String(err),
    });
    return fallback;
  }
}
