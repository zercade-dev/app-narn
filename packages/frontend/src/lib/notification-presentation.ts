import {
  runTypeLabel,
  type CollabDigestData,
  type FailureCode,
  type NotificationRecord,
  type RunNotificationData,
} from '@zercade-dev/narn-shared';
import { useProjectStore } from '../stores/project-store.js';
import { useViewStore } from '../stores/view-store.js';
import { RUN_TYPE_KEY } from './run-kind.js';
import { failureAction, languageName } from './log-presentation/registry.js';
import type { Translate } from './log-presentation/types.js';

/**
 * Turns a stored notification into what the user reads. A typed row stores only
 * its kind and a data payload, so the sentence is built here, in the viewer's
 * language, from that payload. Broadcasts (no kind) keep their stored text.
 *
 * `t` must accept namespaced keys (`'account:notifications.genericTitle'`,
 * `'logs:translation.cause.auth'`, `'strings:runs.typeTranslation'`) because the
 * wording spans three namespaces; i18next's own `t` does, and so does a
 * `useTranslation(['account', 'logs', 'strings'])` one.
 */

export interface NotificationAction {
  id: 'view-activity' | 'fix' | 'open-project';
  label: string;
  disabled?: boolean;
  run: () => void;
}

export interface PresentedNotification {
  title: string;
  body: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  /** Stays unread until acted on or dismissed. */
  problem: boolean;
  /** At most two. */
  actions: NotificationAction[];
}

export interface NotificationContext {
  /** `undefined` means the viewer cannot reach that project. */
  projectName: (projectId: string) => string | undefined;
  activeProjectId: string | null;
}

/**
 * Runs an entry's action. A problem entry (failed run, run with problems) stays
 * unread until the person acts on it, so using any of its actions marks it read.
 */
export function runNotificationAction(
  action: NotificationAction,
  entry: { id: string; problem: boolean; unread: boolean },
  markRead: (id: string) => Promise<void> | void,
): void {
  action.run();
  if (entry.problem && entry.unread) void markRead(entry.id);
}

/** Context backed by the live project store, for components. */
export function notificationContextFromStores(
  projects: ReadonlyArray<{ id: string; name: string }>,
  activeProjectId: string | null,
): NotificationContext {
  return {
    projectName: (id) => projects.find((p) => p.id === id)?.name,
    activeProjectId,
  };
}

const NS = 'account:notifications.';

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function asRunData(data: unknown): RunNotificationData | undefined {
  if (!isObj(data)) return undefined;
  const { runId, projectId, runKind, total, completed, failed, targetLanguages, causes } = data;
  if (!isStr(runId) || !isStr(projectId) || !isStr(runKind)) return undefined;
  if (!isNum(total) || !isNum(completed) || !isNum(failed)) return undefined;
  if (!Array.isArray(targetLanguages) || !targetLanguages.every(isStr)) return undefined;
  if (!Array.isArray(causes)) return undefined;
  if (!causes.every((c) => isObj(c) && isStr(c.code) && isNum(c.count))) return undefined;
  return data as unknown as RunNotificationData;
}

function asDigestData(data: unknown): CollabDigestData | undefined {
  if (!isObj(data) || !isStr(data.projectId) || !Array.isArray(data.collaborators)) {
    return undefined;
  }
  const ok = data.collaborators.every(
    (c) =>
      isObj(c) &&
      (c.name === null || isStr(c.name)) &&
      Array.isArray(c.edits) &&
      c.edits.every((e) => isObj(e) && isStr(e.language) && isNum(e.count)) &&
      isObj(c.translated) &&
      isNum(c.translated.count),
  );
  return ok ? (data as unknown as CollabDigestData) : undefined;
}

/** Cause clauses that already exist in the `logs` namespace; they name a `{{module}}`. */
const CAUSE_KEY: Partial<Record<FailureCode, string>> = {
  auth: 'logs:translation.cause.auth',
  'rate-limit': 'logs:translation.cause.rateLimit',
  timeout: 'logs:translation.cause.timeout',
  'model-unavailable': 'logs:translation.cause.modelUnavailable',
  'parse-failure': 'logs:translation.cause.parse',
  'empty-reply': 'logs:translation.cause.emptyReply',
  'provider-error': 'logs:translation.cause.provider',
  'no-route': `${NS}cause.noRoute`,
  'module-disabled': `${NS}cause.moduleDisabled`,
  'module-not-found': `${NS}cause.moduleNotFound`,
};

/**
 * The cause line: the most common cause named, plus "and N other issues" when
 * more were recorded. An empty list (a run swept after a restart) reads as an
 * unknown cause. The trailing full stop is stripped so the caller's template ends the sentence.
 */
function causeLine(data: RunNotificationData, t: Translate): string {
  const top = data.causes[0];
  const key = top ? CAUSE_KEY[top.code] : undefined;
  const clause = key ? t(key, { module: t(`${NS}theProvider`) }) : t(`${NS}cause.unknown`);
  const base = clause.replace(/[.。]$/, '');
  const others = data.causes.length - 1;
  return others > 0 ? t(`${NS}otherIssues`, { cause: base, count: others }) : base;
}

function languageList(codes: string[]): string {
  return codes.map(languageName).join(', ');
}

function runTypeName(runKind: RunNotificationData['runKind'], t: Translate): string {
  return t(`strings:${RUN_TYPE_KEY[runTypeLabel(runKind)]}`);
}

/** Switches to the notification's project first when it isn't the active one. */
async function ensureProject(projectId: string, ctx: NotificationContext): Promise<void> {
  if (ctx.activeProjectId !== projectId) {
    await useProjectStore.getState().activateProject(projectId);
  }
}

function viewActivityAction(
  data: RunNotificationData,
  t: Translate,
  ctx: NotificationContext,
): NotificationAction {
  const accessible = ctx.projectName(data.projectId) !== undefined;
  return {
    id: 'view-activity',
    label: t(`${NS}viewInActivity`),
    disabled: accessible ? undefined : true,
    run: () => {
      if (!accessible) return;
      void (async () => {
        await ensureProject(data.projectId, ctx);
        useViewStore.getState().openRun(data.runId);
      })();
    },
  };
}

/**
 * The fix for the most common cause that has one (`causes` is most-common
 * first). A fix that opens a project tab acts on the notification's project, not
 * whichever one is active, so it switches there first.
 */
function fixAction(
  data: RunNotificationData,
  t: Translate,
  ctx: NotificationContext,
): NotificationAction | undefined {
  for (const cause of data.causes) {
    const fix = failureAction(cause.code);
    if (!fix) continue;
    const opensProjectTab = cause.code === 'no-route';
    const accessible = ctx.projectName(data.projectId) !== undefined;
    return {
      id: 'fix',
      label: t(`logs:${fix.labelKey}`),
      disabled: opensProjectTab && !accessible ? true : undefined,
      run: opensProjectTab
        ? () => {
            if (!accessible) return;
            void (async () => {
              await ensureProject(data.projectId, ctx);
              fix.run();
            })();
          }
        : fix.run,
    };
  }
  return undefined;
}

/** Appends the project's name to a body; nothing when the viewer can't reach it. */
function withProject(
  body: string,
  projectId: string,
  t: Translate,
  ctx: NotificationContext,
): string {
  const project = ctx.projectName(projectId);
  return project ? `${body} ${t(`${NS}inProject`, { project })}` : body;
}

function openProjectAction(
  projectId: string,
  t: Translate,
  ctx: NotificationContext,
): NotificationAction {
  const accessible = ctx.projectName(projectId) !== undefined;
  return {
    id: 'open-project',
    label: t(`${NS}openProject`),
    disabled: accessible ? undefined : true,
    run: () => {
      if (!accessible) return;
      void ensureProject(projectId, ctx).then(() => useViewStore.getState().setView('project'));
    },
  };
}

function presentRun(
  kind: 'run-started' | 'run-finished' | 'run-finished-with-problems' | 'run-failed',
  data: RunNotificationData,
  t: Translate,
  ctx: NotificationContext,
): PresentedNotification {
  const type = runTypeName(data.runKind, t);
  const view = viewActivityAction(data, t, ctx);
  const fix = fixAction(data, t, ctx);
  const named = (body: string) => withProject(body, data.projectId, t, ctx);
  const languages = languageList(data.targetLanguages);
  switch (kind) {
    case 'run-started':
      return {
        title: t(`${NS}runStarted.title`, { type }),
        body: named(t(`${NS}runStarted.body`, { count: data.total })),
        tone: 'info',
        problem: false,
        actions: [view],
      };
    case 'run-finished':
      return {
        title: t(`${NS}runFinished.title`, { type }),
        body: named(
          languages
            ? t(`${NS}runFinished.bodyLanguages`, { count: data.completed, languages })
            : t(`${NS}runFinished.body`, { count: data.completed }),
        ),
        tone: 'success',
        problem: false,
        actions: [view],
      };
    case 'run-finished-with-problems':
      return {
        title: t(`${NS}runFinishedWithProblems.title`, { type }),
        body: named(
          t(`${NS}runFinishedWithProblems.body`, {
            completed: data.completed,
            failed: data.failed,
            cause: causeLine(data, t),
          }),
        ),
        tone: 'warning',
        problem: true,
        actions: fix ? [fix, view] : [view],
      };
    case 'run-failed': {
      return {
        title: t(`${NS}runFailed.title`, { type }),
        body: named(t(`${NS}runFailed.body`, { cause: causeLine(data, t) })),
        tone: 'error',
        problem: true,
        actions: fix ? [fix, view] : [view],
      };
    }
  }
}

function presentDigest(
  data: CollabDigestData,
  t: Translate,
  ctx: NotificationContext,
): PresentedNotification | undefined {
  const lines: string[] = [];
  for (const c of data.collaborators) {
    const name = c.name ?? t(`${NS}aCollaborator`);
    const edits = c.edits
      .filter((e) => e.count > 0)
      .map((e) =>
        t(`${NS}collabDigest.editsIn`, { count: e.count, language: languageName(e.language) }),
      )
      .join(', ');
    const translated = c.translated.count;
    const translatedIn =
      translated > 0 && c.translated.languages?.length
        ? ` ${t(`${NS}collabDigest.translatedLanguages`, { languages: languageList(c.translated.languages) })}`
        : '';
    if (edits && translated > 0) {
      lines.push(t(`${NS}collabDigest.both`, { name, edits, count: translated }) + translatedIn);
    } else if (edits) {
      lines.push(t(`${NS}collabDigest.edited`, { name, edits }));
    } else if (translated > 0) {
      lines.push(t(`${NS}collabDigest.translated`, { name, count: translated }) + translatedIn);
    }
  }
  if (lines.length === 0) return undefined;
  return {
    title: t(`${NS}collabDigest.title`),
    body: withProject(lines.join(' '), data.projectId, t, ctx),
    tone: 'info',
    problem: false,
    actions: [openProjectAction(data.projectId, t, ctx)],
  };
}

const TONE_BY_SEVERITY: Record<NotificationRecord['severity'], PresentedNotification['tone']> = {
  info: 'info',
  warning: 'warning',
  critical: 'error',
};

export function presentNotification(
  n: NotificationRecord,
  t: Translate,
  ctx: NotificationContext,
): PresentedNotification {
  const tone = TONE_BY_SEVERITY[n.severity] ?? 'info';
  if (n.kind === null || n.kind === undefined) {
    return { title: n.title, body: n.body, tone, problem: false, actions: [] };
  }
  let presented: PresentedNotification | undefined;
  switch (n.kind) {
    case 'run-started':
    case 'run-finished':
    case 'run-finished-with-problems':
    case 'run-failed': {
      const data = asRunData(n.data);
      presented = data ? presentRun(n.kind, data, t, ctx) : undefined;
      break;
    }
    case 'collab-digest': {
      const data = asDigestData(n.data);
      presented = data ? presentDigest(data, t, ctx) : undefined;
      break;
    }
  }
  return (
    presented ?? {
      title: t(`${NS}genericTitle`),
      body: '',
      tone,
      problem: false,
      actions: [],
    }
  );
}
