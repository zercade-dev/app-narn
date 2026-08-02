/**
 * Typed client for the cloud `/auth/collab/*` surface. NOT {@link apiRequest}
 * (`hooks/use-api.ts`): these routes deliberately live outside `/api` — they
 * must stay reachable regardless of vault state and out of the paid-LLM
 * rate limiter — so they carry a different error envelope —
 * `{ error: '<snake_case>' }` on 4xx, and possibly branded HTML on an
 * unexpected 500 (the routes try to answer JSON on every known failure, but
 * an upstream proxy/crash could still hand back HTML — {@link collabFetch}
 * tolerates that by mapping any non-JSON error body to `'unknown_error'`).
 *
 * Every export funnels through the one internal {@link collabFetch} so the
 * request/response shape (Content-Type, JSON parse, error mapping) is
 * defined in exactly one place.
 */

/**
 * Thrown by every `collab-api` call on a non-2xx response. `code` is the
 * server's `error` field (snake_case, e.g. `'nickname_taken'`), or
 * `'unknown_error'` when the body wasn't parseable JSON with an `error`
 * string (the HTML-500 tolerance described above).
 */
export class CollabApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'CollabApiError';
  }
}

/** Mirrors the server's `InviteRecord` shape (camelCase over the wire). */
export interface InviteRecord {
  id: string;
  projectId: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  redeemedBy: string | null;
  redeemedAt: string | null;
  revokedAt: string | null;
}

/**
 * Runs one request against `/auth/collab<path>`, parses the JSON body, and
 * throws {@link CollabApiError} on `!ok`. A `204 No Content` response (e.g.
 * `revokeInvite`) has no body to parse and resolves to `undefined`.
 *
 * Non-JSON bodies (including a branded HTML error page on an unexpected 500)
 * parse to `undefined`, which maps to the `'unknown_error'` code on failure
 * and to `undefined` on an (unexpected) success — callers of 2xx-with-body
 * endpoints always get real JSON from the routes they call, so this only
 * matters on the error path in practice.
 */
async function collabFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {};
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(`/auth/collab${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const code =
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : 'unknown_error';
    throw new CollabApiError(code, response.status);
  }

  return body as T;
}

/** `GET /auth/collab/nickname` — the caller's own claimed nickname, or `null`. */
export async function getNickname(): Promise<string | null> {
  const data = await collabFetch<{ nickname: string | null }>('/nickname');
  return data.nickname;
}

/**
 * `POST /auth/collab/nickname` — claim the caller's (one and only, ever)
 * display nickname. Throws `CollabApiError` with code `'invalid_nickname'`,
 * `'nickname_taken'`, `'nickname_already_claimed'`, or `'nickname_reserved'`
 * (a first-person self-reference word on the server's blocklist — kept
 * unclaimable so the `@me/…` display placeholder stays unambiguous).
 */
export async function claimNickname(nickname: string): Promise<void> {
  await collabFetch('/nickname', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  });
}

/** `POST /auth/collab/nicknames/resolve` — bulk userId → nickname lookup. */
export async function resolveNicknames(userIds: string[]): Promise<Record<string, string>> {
  const data = await collabFetch<{ nicknames: Record<string, string> }>('/nicknames/resolve', {
    method: 'POST',
    body: JSON.stringify({ userIds }),
  });
  return data.nicknames;
}

/** `GET /auth/collab/projects/:projectId/invites` — a project's full invite history (owner-only). */
export async function listInvites(projectId: string): Promise<InviteRecord[]> {
  const data = await collabFetch<{ invites: InviteRecord[] }>(`/projects/${projectId}/invites`);
  return data.invites;
}

/**
 * `POST /auth/collab/projects/:projectId/invites` — mint a new one-use invite
 * code (owner-only). `code` is the raw code, shown exactly once. Throws
 * `CollabApiError` with code `'nickname_required'` or `'too_many_pending_invites'`.
 */
export async function createInvite(
  projectId: string,
): Promise<{ code: string; invite: InviteRecord }> {
  return collabFetch<{ code: string; invite: InviteRecord }>(`/projects/${projectId}/invites`, {
    method: 'POST',
  });
}

/**
 * `POST /auth/collab/projects/:projectId/invites/:inviteId/revoke` — owner
 * cancels a pending invite. Throws `CollabApiError('invite_not_found')`
 * when the invite doesn't exist or isn't pending.
 */
export async function revokeInvite(projectId: string, inviteId: string): Promise<void> {
  await collabFetch(`/projects/${projectId}/invites/${inviteId}/revoke`, { method: 'POST' });
}

/**
 * `POST /auth/collab/join` — redeem an invite code and join its project as a
 * collaborator. Throws `CollabApiError` with code `'invalid_invite'`,
 * `'nickname_required'`, `'already_member'`, `'project_full'`,
 * `'cannot_join_own_project'`, or `'join_failed'`.
 */
export async function joinProject(code: string): Promise<{ projectId: string }> {
  return collabFetch<{ projectId: string }>('/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/**
 * `GET /auth/collab/shared-projects` — every project the caller has been
 * invited into as a collaborator, with the owner's display nickname (`null`
 * when the owner hasn't claimed one).
 */
export async function listSharedProjects(): Promise<
  Array<{ projectId: string; ownerNickname: string | null }>
> {
  const data = await collabFetch<{
    projects: Array<{ projectId: string; ownerNickname: string | null }>;
  }>('/shared-projects');
  return data.projects;
}
