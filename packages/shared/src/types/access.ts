/**
 * Collaboration access model. ONE decision function: every project-scoped
 * authorization check flows through can(). Owners hold every capability;
 * collaborators hold read plus language-scoped capabilities on their
 * writable_languages set (empty set = read-only member). Language-level
 * granularity lives HERE (the app layer) — RLS cannot see which language key
 * a JSON patch touches.
 */
export type ProjectRole = 'owner' | 'collaborator';

export interface ProjectAccess {
  role: ProjectRole;
  /** Languages this member may write. Ignored for owners. */
  writableLanguages: string[];
}

export type Capability =
  | { type: 'read' }
  | { type: 'manage' }
  | { type: 'write-language'; language: string }
  | { type: 'run-ai'; languages: string[] }
  | { type: 'review-manual'; language: string }
  | { type: 'glossary-edit'; languages: string[] };

export function can(access: ProjectAccess, capability: Capability): boolean {
  if (access.role === 'owner') return true;
  switch (capability.type) {
    case 'read':
      return true;
    case 'manage':
      return false;
    case 'write-language':
    case 'review-manual':
      return access.writableLanguages.includes(capability.language);
    case 'run-ai':
    case 'glossary-edit':
      return (
        capability.languages.length > 0 &&
        capability.languages.every((lang) => access.writableLanguages.includes(lang))
      );
  }
}
