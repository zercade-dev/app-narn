import { Router } from 'express';
import { z } from 'zod';
import { csvImporter } from '../modules/M2-csv-importer.js';
import { contentClassifier } from '../modules/M5-content-classifier.js';
import { getOrphanIds } from '../modules/orphan-id-store.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import { lqaGate } from '../modules/M10-lqa-gate.js';
import { parse as parseTags } from '../modules/M14-tag-parser.js';
import { runImportPipeline } from '../services/import-pipeline.js';
import type { Project, ProjectAccess, StringEntry } from '@zercade-dev/narn-shared';
import {
  LANGUAGE_REGISTRY,
  PSEUDO_LANGUAGE_CODE,
  isAchievementSource,
} from '@zercade-dev/narn-shared';
import { ValidationError } from '../types/errors.js';
import { assertProjectAccess, assertEntryPatchAllowed } from '../middleware/authz.js';
import { getMemberStore, getProjectStore, getStringStore } from '../storage/registry.js';
import type { StringQueryFilters } from '../storage/types.js';
import { asyncHandler } from '../http/index.js';
import { projectIdParam } from '../middleware/path-params.js';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { logger } from '../modules/M15-console-logger.js';
import { singleFileUpload, requireFile } from '../utils/upload.js';
import { extensionFileFilter, validateUploadedFile } from '../utils/file-validation.js';

export const stringsRouter: Router = Router();

// Validate `:id` against path traversal for every route below (400 centrally on
// a hostile id), so handlers read the pre-validated value directly.
stringsRouter.param('id', projectIdParam);

// Anti-malware hardening for the CSV import upload: extension allowlist (fast
// fileFilter reject) plus, once buffered, magic-byte content verification
// (executable/script signatures rejected regardless of the claimed extension
// or client-supplied MIME type — see utils/file-validation.ts).
const upload = singleFileUpload({
  maxBytes: 50 * 1024 * 1024, // 50 MB
  fileFilter: extensionFileFilter(['.csv', '.txt']),
});

// Bound CSV import frequency so repeated large uploads cannot exhaust memory/CPU.
const importRateLimiter = rateLimiter({ maxRequests: 30, windowMs: 60_000 });

const translationRecordSchema = z.object({
  text: z.string(),
  status: z.enum(['pending', 'translated', 'reviewed', 'flagged']).default('translated'),
  moduleId: z.string().default('manual'),
  timestamp: z.number().default(() => Date.now()),
  needsReview: z.boolean().optional(),
  // Freeway serving-bucket quality tier (Addendum H). Accepted here purely so
  // a client round-trip (load an entry, edit, PUT it back) doesn't silently
  // drop a tier the server already stamped — the field is never set BY this
  // schema, only preserved through it.
  freewayTier: z.number().int().min(1).max(4).optional(),
  // Companion ledger key of the serving Freeway bucket (Addendum H), same
  // round-trip-preservation rationale as freewayTier above.
  freewayBucketKey: z.string().optional(),
});

// For PATCH operations we must not apply defaults, otherwise partial flag
// updates (e.g. needsReview) can overwrite provenance metadata like moduleId.
const translationRecordPatchSchema = z.object({
  text: z.string().optional(),
  status: z.enum(['pending', 'translated', 'reviewed', 'flagged']).optional(),
  moduleId: z.string().optional(),
  timestamp: z.number().optional(),
  needsReview: z.boolean().optional(),
  freewayTier: z.number().int().min(1).max(4).optional(),
  freewayBucketKey: z.string().optional(),
});

// Exported so its shape can be tested directly (schema-only, no Express/mocking) —
// its shape is kept in parity with StringEntry by a schema-parity test.
export const updateEntrySchema = z.object({
  // `null` clears a prior value. Setting a non-null value is gated to
  // achievement-source entries in the PUT handler below.
  achievementType: z.enum(['name', 'description']).nullable().optional(),
  achievementId: z.string().min(1).max(200).nullable().optional(),
  categories: z.array(z.string()).optional(),
  context: z.string().optional(),
  overflowRatio: z.number().positive().optional(),
  ignoreOverflow: z.boolean().optional(),
  // Excludes the entry from every AI dispatch site (translate, judge,
  // source-review, glossary-gen, category-gen) — set via the Multi-language
  // Text / Compare tabs' ignore toggle (per-row or bulk).
  ignored: z.boolean().optional(),
  // Set true only by the CSV importer for genuinely new entries; the only
  // client-initiated write is clearing it back to false (the Multi-language
  // Text tab's "Clear new flags" bulk/per-entry action).
  flaggedNew: z.boolean().optional(),
  assignedGlossaryIds: z.array(z.string()).optional(),
  metadata: z
    .object({
      character: z.string().optional(),
      tone: z.string().optional(),
      gender: z.string().optional(),
    })
    .optional(),
  translations: z.record(z.string(), translationRecordSchema).optional(),
});

const booleanFlag = z.enum(['true', 'false']).optional();

const listStringsQuerySchema = z.object({
  category: z.string().optional(),
  source: z.string().optional(),
  language: z.string().optional(),
  status: z.enum(['pending', 'translated', 'reviewed', 'flagged']).optional(),
  untranslated: booleanFlag,
  lqaFailed: booleanFlag,
  runId: z.string().optional(),
});

// GET /api/projects/:id/strings
stringsRouter.get(
  '/:id/strings',
  validateQuery(listStringsQuerySchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    // Non-members get the standard existence-hiding 404 (RLS alone would return 200 []).
    await assertProjectAccess(projectId, { type: 'read' });
    const { category, source, language, status, untranslated, lqaFailed, runId } =
      req.query as z.infer<typeof listStringsQuerySchema>;
    const filters: StringQueryFilters = {
      category,
      source,
      language,
      translationStatus: status,
      untranslatedOnly: untranslated === 'true',
      lqaFailed: lqaFailed === 'true',
      runId,
    };
    const entries = await getStringStore().query(projectId, filters);
    const orphanIdSet = new Set(getOrphanIds(projectId));
    // Hide orphans from the working list: add-only orphans (in-memory ids)
    // and full-replace orphans (persisted orphanedAt).
    res.json(entries.filter((e) => !orphanIdSet.has(e.id) && e.orphanedAt == null));
  }),
);

// GET /api/projects/:id/strings/:entryId
stringsRouter.get(
  '/:id/strings/:entryId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const entry = await getStringStore().getById(projectId, req.params.entryId);
    res.json(entry);
  }),
);

async function applyCategoryDiff(
  projectId: string,
  entryId: string,
  nextCategories: string[],
): Promise<void> {
  const existing = await getStringStore().getById(projectId, entryId);
  const existingSet = new Set(existing.categories);
  const targetSet = new Set(nextCategories);
  for (const c of nextCategories) {
    if (!existingSet.has(c)) {
      await contentClassifier.addCategory(projectId, entryId, c);
    }
  }
  for (const c of existing.categories) {
    if (!targetSet.has(c)) {
      await contentClassifier.removeCategory(projectId, entryId, c);
    }
  }
}

/** The PUT body minus `categories` (which is applied separately, via M5). */
type EntryFieldPatch = Omit<z.infer<typeof updateEntrySchema>, 'categories'>;

/**
 * The stored entry as it will look once THIS request's field writes land.
 *
 * The LQA recompute below runs BEFORE the handler's single `updateEntry` call,
 * so checking against the stored snapshot alone judges the incoming translation
 * by the entry's PREVIOUS flags — and several checks read exactly the fields
 * this same request may be setting: `ignoreOverflow` / `overflowRatio`
 * (overflow), `achievementType` (both length-limit checks), and
 * `assignedGlossaryIds` (glossary adherence). Ticking "ignore overflow" while
 * pasting a long translation in one save therefore used to persist a stale
 * overflow warning that only an unrelated later write cleared.
 *
 * Mirrors the store's merge semantics: scalar fields replace wholesale,
 * `translations` merge per language.
 */
function withPendingWrites(stored: StringEntry, patch: EntryFieldPatch): StringEntry {
  return {
    ...stored,
    ...patch,
    translations: { ...stored.translations, ...patch.translations },
  };
}

async function buildTranslationLqa(
  projectId: string,
  entryId: string,
  patch: EntryFieldPatch & {
    translations: NonNullable<z.infer<typeof updateEntrySchema>['translations']>;
  },
): Promise<StringEntry['lqaResults']> {
  const existing = withPendingWrites(await getStringStore().getById(projectId, entryId), patch);
  const translations = patch.translations;
  // Seed from {} (NOT { ...existing.lqaResults }): this whole map is passed as
  // `partial.lqaResults` to `updateEntry`, which per-key MERGES it onto the
  // stored verdicts under the write lock. Spreading the pre-lock snapshot here
  // would re-assert stale sibling-language verdicts and revert any verdict a
  // concurrent run wrote during the snapshot window. Emitting ONLY the edited
  // languages lets the store's merge preserve every untouched language.
  const lqaResults: StringEntry['lqaResults'] = {};
  for (const [lang, rec] of Object.entries(translations)) {
    if (rec?.text) {
      lqaResults[lang] = await lqaGate.check(existing, rec.text, lang, { projectId });
    }
  }
  return lqaResults;
}

/**
 * Manual-edit-audit eligibility: record only when the owner has turned the
 * project flag on AND the project is actually shared — a solo owner editing
 * their own single-owner project gets no audit noise. "Shared" mirrors the
 * CURRENT-membership half of `GET /api/projects`'s `sharedEver` (a
 * collaborator role implies >=2 members by construction; for the owner's own
 * request, a member-count check is the direct per-project equivalent). This
 * deliberately skips that endpoint's additional run-HISTORY widening (a
 * project that lost all collaborators after being shared) — cheap to add
 * later if the audit is ever expected to persist eligibility past every
 * collaborator leaving, but out of scope for a per-write-path check. The
 * `manualEditAuditEnabled` check short-circuits first, so the extra
 * `listMembers` query only runs when the flag is actually on.
 */
async function resolveRecordManualEdits(
  projectId: string,
  project: Project,
  access: ProjectAccess,
): Promise<boolean> {
  if (project.manualEditAuditEnabled !== true) return false;
  if (access.role === 'collaborator') return true;
  const members = await getMemberStore().listMembers(projectId);
  return members.length > 1;
}

// PUT /api/projects/:id/strings/:entryId
stringsRouter.put(
  '/:id/strings/:entryId',
  validateBody(updateEntrySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof updateEntrySchema>;
    const { categories, ...rest } = body;
    const projectId = req.params.id as string;
    const entryId = req.params.entryId as string;

    const access = await assertProjectAccess(projectId, { type: 'read' });
    assertEntryPatchAllowed(access, body);

    // A (non-null) achievementType/achievementId is only meaningful on entries
    // whose source is an Achievement label — enforce server-side so a direct API
    // call can't put an entry into a semantically invalid state. `null`
    // (clearing) is always ok.
    if (rest.achievementType != null || rest.achievementId != null) {
      const existing = await getStringStore().getById(projectId, entryId);
      if (!isAchievementSource(existing.sources)) {
        throw new ValidationError(
          'achievementType/achievementId can only be set on entries with an Achievement source',
        );
      }
    }

    // flaggedNew is only ever set true by the CSV importer for genuinely new
    // entries; a client can only clear it (false), never set it.
    if (rest.flaggedNew === true) {
      throw new ValidationError('flaggedNew cannot be set to true via this endpoint');
    }

    // Delegate category writes through M5 ContentClassifier.
    if (categories !== undefined) {
      await applyCategoryDiff(projectId, entryId, categories);
    }

    // If translations are being updated, run basic LQA and attach results
    const partial: Partial<Omit<StringEntry, 'id' | 'createdAt'>> = rest.translations
      ? {
          ...rest,
          lqaResults: await buildTranslationLqa(projectId, entryId, {
            ...rest,
            translations: rest.translations,
          }),
        }
      : rest;

    // A client-driven assignedGlossaryIds write is only a genuine manual
    // override for the ids that actually CHANGED — the UI always sends the
    // entry's whole current selection (auto-matched + manual combined), so
    // mirroring the array wholesale would permanently pin every
    // currently-auto-matched id as "manual" too. Diff against the entry's
    // prior state instead: an id newly present becomes pinned; an id newly
    // absent is unpinned; everything else (including an already-matched id
    // the user never touched) is left alone.
    if (partial.assignedGlossaryIds !== undefined) {
      const existing = await getStringStore().getById(projectId, entryId);
      const existingAssigned = existing.assignedGlossaryIds ?? [];
      const incoming = partial.assignedGlossaryIds;
      const added = incoming.filter((id) => !existingAssigned.includes(id));
      const removed = existingAssigned.filter((id) => !incoming.includes(id));
      const existingManual = existing.manualGlossaryIds ?? [];
      const nextManual = Array.from(new Set([...existingManual, ...added])).filter(
        (id) => !removed.includes(id),
      );
      partial.manualGlossaryIds = nextManual.length > 0 ? nextManual : undefined;
    }

    const hasRemainingWrites = Object.keys(partial).length > 0;
    let updated: StringEntry;
    if (!hasRemainingWrites) {
      updated = await getStringStore().getById(projectId, entryId);
    } else {
      const project = await getProjectStore().loadProject(projectId);
      const recordManualEdits = await resolveRecordManualEdits(projectId, project, access);
      updated = recordManualEdits
        ? await getStringStore().updateEntry(projectId, entryId, partial, {
            recordManualEdits: true,
          })
        : await getStringStore().updateEntry(projectId, entryId, partial);
    }
    res.json(updated);
  }),
);

// DELETE /api/projects/:id/strings/:entryId
stringsRouter.delete(
  '/:id/strings/:entryId',
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    await getStringStore().deleteEntry(projectId, req.params.entryId as string);
    res.status(204).send();
  }),
);

export const bulkUpdateSchema = z.object({
  ids: z.array(z.string()).min(1).max(1000),
  // achievementType/achievementId are per-entry (gated to achievement sources)
  // and not a bulk operation — omit them here so they can't be set across an
  // arbitrary id set.
  partial: updateEntrySchema.omit({ achievementType: true, achievementId: true }).extend({
    translations: z.record(z.string(), translationRecordPatchSchema).optional(),
  }),
});

// PATCH /api/projects/:id/strings — bulk update entries by id
stringsRouter.patch(
  '/:id/strings',
  validateBody(bulkUpdateSchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;
    const { ids, partial } = req.body as z.infer<typeof bulkUpdateSchema>;
    const access = await assertProjectAccess(projectId, { type: 'read' });
    assertEntryPatchAllowed(access, partial);
    if (partial.flaggedNew === true) {
      throw new ValidationError('flaggedNew cannot be set to true via this endpoint');
    }
    const project = await getProjectStore().loadProject(projectId);
    const recordManualEdits = await resolveRecordManualEdits(projectId, project, access);
    // Deliberately WHOLESALE, unlike the PUT handler's diff-based mirror
    // above: diffing against N entries' individual prior states doesn't fit
    // a single shared `partial` object here. Known, accepted limitation —
    // a bulk assignedGlossaryIds write pins the entry's whole current
    // selection as manual, including any currently-auto-matched ids. The
    // PUT path (the context-menu sheet, the only UI surface that forces a
    // glossary today) gets the precise diff; this one doesn't. `partial`
    // here is zod-inferred (no manualGlossaryIds key), so build a fresh
    // object rather than mutating it.
    const partialWithManual =
      partial.assignedGlossaryIds !== undefined
        ? { ...partial, manualGlossaryIds: partial.assignedGlossaryIds }
        : partial;
    const updated = recordManualEdits
      ? await getStringStore().bulkUpdate(projectId, ids, partialWithManual, {
          recordManualEdits: true,
        })
      : await getStringStore().bulkUpdate(projectId, ids, partialWithManual);
    res.json(updated);
  }),
);

// POST /api/projects/:id/import — multipart CSV upload
stringsRouter.post(
  '/:id/import',
  importRateLimiter,
  upload,
  requireFile,
  asyncHandler(async (req, res) => {
    const file = req.file!;
    validateUploadedFile(file.originalname, file.buffer, {
      allowedExtensions: ['.csv', '.txt'],
    });
    const csvContent = file.buffer.toString('utf-8');
    const projectId = req.params.id as string;
    await assertProjectAccess(projectId, { type: 'manage' });
    // Multipart text fields (not validateBody — this route is multer-parsed):
    // validate `mode` manually, default add-only so existing clients are
    // byte-compatible. `dryRun: 'true'` previews without writing.
    const body = (req.body ?? {}) as Record<string, unknown>;
    const modeRaw = body.mode ?? 'add-only';
    if (modeRaw !== 'add-only' && modeRaw !== 'full-replace') {
      throw new ValidationError("mode must be 'add-only' or 'full-replace'");
    }
    const dryRun = body.dryRun === 'true' || body.dryRun === true;
    const result = await runImportPipeline(projectId, csvContent, { dryRun, mode: modeRaw });
    res.json(result);
  }),
);

const parseTagsSchema = z.object({ text: z.string() });

// POST /api/projects/:id/parse-tags — parse inline tags via M14 and return AST
stringsRouter.post(
  '/:id/parse-tags',
  validateBody(parseTagsSchema),
  asyncHandler(async (req, res) => {
    const { text } = req.body as z.infer<typeof parseTagsSchema>;
    res.json(parseTags(text));
  }),
);

const exportQuerySchema = z.object({
  languages: z.string().optional(),
  includeContext: booleanFlag,
  discardUntranslatable: booleanFlag,
  template: z.enum(['true']).optional(),
  pseudoAs: z
    .string()
    .refine((code) => LANGUAGE_REGISTRY.some((l) => l.code === code), {
      message: 'unknown language code',
    })
    .refine((code) => code !== PSEUDO_LANGUAGE_CODE, {
      message: 'pseudoAs must be a real language',
    })
    .optional(),
});

// GET /api/projects/:id/export
stringsRouter.get(
  '/:id/export',
  validateQuery(exportQuerySchema),
  asyncHandler(async (req, res) => {
    const projectId = req.params.id as string;

    if (req.query.template === 'true') {
      const csv = await csvImporter.exportTemplateCSVString(projectId, {
        includeContext: req.query.includeContext === 'true',
        languages:
          typeof req.query.languages === 'string' && req.query.languages
            ? req.query.languages
                .split(',')
                .map((l) => l.trim())
                .filter(Boolean)
            : undefined,
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="template-${projectId}.csv"`);
      res.send(csv);
      return;
    }

    const languagesParam = req.query.languages;
    const languages =
      typeof languagesParam === 'string' && languagesParam
        ? languagesParam
            .split(',')
            .map((l) => l.trim())
            .filter(Boolean)
        : undefined;
    const pseudoAs = typeof req.query.pseudoAs === 'string' ? req.query.pseudoAs : undefined;
    if (pseudoAs !== undefined) {
      const project = await getProjectStore().loadProject(projectId);
      if (pseudoAs === project.sourceLanguage) {
        res.status(400).json({ error: 'pseudoAs cannot be the source language' });
        return;
      }
    }
    const { csv, roundTripWarnings } = await csvImporter.exportCSVWithWarnings(projectId, {
      includeContext: req.query.includeContext === 'true',
      languages,
      pseudoAs,
      discardUntranslatable: req.query.discardUntranslatable === 'true',
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="export-${projectId}.csv"`);
    // Advisory: cells whose content contains a quote+comma/newline mis-split on
    // re-import (game dialect is not RFC-4180). Surfaced as response headers so
    // the client can warn without altering the CSV body. The columns header is
    // ASCII-safe (language/column names) for HTTP header compatibility.
    if (roundTripWarnings.count > 0) {
      res.setHeader('X-Export-Roundtrip-Warnings', String(roundTripWarnings.count));
      res.setHeader('X-Export-Roundtrip-Columns', roundTripWarnings.columns.join(', '));
      logger.warn('csv-export:roundtrip-unsafe', {
        projectId,
        count: roundTripWarnings.count,
        columns: roundTripWarnings.columns,
      });
    }
    res.send(csv);
  }),
);
