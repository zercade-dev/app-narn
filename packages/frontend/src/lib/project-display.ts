/**
 * Cloud-only project naming + color helpers. A single `displayName`
 * centralizes the `@alias/name` rule so the selector list rows and the
 * selector trigger in `Sidebar.tsx` can't drift from each other;
 * `rowTintClass` centralizes the own-vs-collab fixed-hue row tint the same
 * way.
 */

export interface DisplayNameArgs {
  name: string;
  role: 'owner' | 'collaborator';
  /** The collaboration's OWNER alias (`ownerNicknames[id]`), `null` when the owner hasn't claimed one. */
  ownerNickname: string | null;
  /** The current viewer's own claimed alias, `null` when unclaimed. */
  selfNickname: string | null;
  /** Gate: local/open-core mode always renders the bare name, no `@…/` prefix. */
  cloudManaged: boolean;
}

/**
 * `@alias/name` display rule (cloud mode only; bare `name` otherwise):
 * - Own project (`role: 'owner'`): `@<selfNickname>/name`, falling back to
 *   `@me/name` when the viewer hasn't claimed a nickname.
 * - Collaboration (`role: 'collaborator'`): ALWAYS the owner's alias
 *   (`@<ownerNickname>/name`), independent of the viewer's own alias.
 *   Falls back to `@…/name` when the owner hasn't claimed one yet (mirrors
 *   the prior inline Sidebar behavior).
 */
export function displayName(args: DisplayNameArgs): string {
  if (!args.cloudManaged) return args.name;
  const alias =
    args.role === 'collaborator' ? (args.ownerNickname ?? '…') : (args.selfNickname ?? 'me');
  return `@${alias}/${args.name}`;
}

/**
 * Full-row own-vs-collaboration tint (blue vs amber; fixed hues, not the theme
 * accent). Opacity-tint background + colored left edge so it reads on ANY
 * surface — light/dark popovers and the techno theme's dark-in-light sidebar —
 * while text color stays inherited from the surface.
 */
export function rowTintClass(role: 'owner' | 'collaborator'): string {
  return role === 'collaborator'
    ? 'border-l-2 border-l-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
    : 'border-l-2 border-l-blue-500 bg-blue-500/10 hover:bg-blue-500/20';
}
