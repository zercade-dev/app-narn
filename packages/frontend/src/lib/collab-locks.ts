/**
 * The single UI-side write-lock question. Wraps the shared `can()` decision
 * function (`@zercade-dev/narn-shared`'s `types/access.ts`) so components
 * never re-derive per-language write rules themselves. Server enforcement is the
 * real authorization boundary (RLS + route guards) — this is honest-UI only,
 * so a locked control never even offers a save the server would reject.
 */
import { can } from '@zercade-dev/narn-shared';
import type { ProjectAccessInfo } from '../stores/project-store.js';

/** True when the current access may WRITE `language` (owners: always). */
export function canWriteLanguage(access: ProjectAccessInfo, language: string): boolean {
  return can(
    { role: access.role, writableLanguages: access.writableLanguages },
    { type: 'write-language', language },
  );
}

/** Languages of `all` the access may write (order-preserving). */
export function writableSubset(access: ProjectAccessInfo, all: readonly string[]): string[] {
  return all.filter((lang) => canWriteLanguage(access, lang));
}
