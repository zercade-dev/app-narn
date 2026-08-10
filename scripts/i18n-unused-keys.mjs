#!/usr/bin/env node
/**
 * Reverse-direction locale key sweep: which ENGLISH keys have no reachable
 * call site, as opposed to check-locales.mjs's used-key rule, which proves
 * the opposite direction (every key a component calls exists).
 *
 *   node scripts/i18n-unused-keys.mjs   (usually via `pnpm i18n:unused`)
 *
 * THIS IS A REPORT, NOT A GATE. The used-key rule in locale-rules.mjs is
 * one-directional by design: it walks the frontend source for statically
 * analysable `t('…')` calls and checks each against the locale files, so it
 * can prove every call site resolves. It cannot prove the converse — that
 * every key on disk is reachable — because keys are also reached through
 * computed lookups the scanner deliberately skips (`t(\`errors.${code}\`)`,
 * a key built from a variable, a namespace chosen at runtime). A checker that
 * flags those as dead would be wrong on sight, so removals this reporter
 * suggests are reviewed by hand before deleting anything.
 *
 * Reuses loadLocales / flattenKeys / readSourceFiles / usedKeysInSource /
 * MIN_SOURCE_FILES from locale-rules.mjs rather than re-scanning: that
 * module's scoping rules (tracked binding forms, the ambiguous-binding skip,
 * single-quoted literals only, namespace-prefixed keys skipped, plural and
 * ordinal suffix tolerance) are what keep the used-key guard false-positive
 * free in the repo's own CI, and re-deriving them here would just be a
 * second implementation to keep in sync.
 *
 * ---------------------------------------------------------------------------
 * CONFIRMED FALSE POSITIVES — every one below was a hit on the first run of
 * this reporter (382 total) and was individually verified reachable: grepped
 * for the key's bare last segment, grepped for its English value, and traced
 * the call site below. None is a literal `t('ns:key')` the scanner missed;
 * each is one of the mechanisms it deliberately does not follow. Checked here
 * first before treating a fresh hit on one of these namespaces as new — if a
 * future run reports one of these again, that is expected, not a regression.
 * Grouped by MECHANISM, not by key, since one call site or lookup table
 * commonly accounts for a whole namespace's worth of hits.
 *
 * 1. Backtick template call `t(\`literal.${var}...\`)` — the namespace is a
 *    tracked binding, but the key has an interpolation, which the scanner's
 *    single-quoted-literal-only rule skips on purpose:
 *      - welcome:themeChooser.{modes,names,taglines}.* —
 *        components/theme-chooser/ThemeChooserOverlay.tsx:216,255,257
 *      - stage-details:fields.*.{label,placeholder} —
 *        components/stage-details/{TranslationsPanel.tsx:93,
 *        StageDetailsTab.tsx:465,SourceFieldEditor.tsx:110,157,
 *        StageChatPanel.tsx:125,326,377,418}
 *      - stage-details:chatQuickPrompts.*, chatQuickActions.* —
 *        components/stage-details/StageChatPanel.tsx:159-160,475
 *      - console:filter_* (incl. filter_notifications) —
 *        components/layout/ConsolePanel.tsx:414, iterating
 *        `FILTER_LEVELS` (line 54)
 *      - collab:errors.* — components/collab/NicknameSection.tsx:97,
 *        components/collab/JoinProjectForm.tsx:109
 *      - colorText:swatches.* — components/color-text/PaletteSection.tsx:85
 *      - settings:themes.*.{name,description} —
 *        components/settings/SettingsView.tsx:115,117
 *      - account:notificationsSeverity.* —
 *        components/account/NotificationsTab.tsx:109
 *      - quality:checkLabels.* — components/quality/QualityTab.tsx:100
 *      - strings:achievement.* —
 *        components/string-table/AchievementLinkDialog.tsx:116,
 *        StringTableRow.tsx:487
 *      - collab:invites.status.* — components/sharing/InvitesSection.tsx:237
 *      - config:lqa.checks.*.{name,description} —
 *        components/config/LqaChecksPanel.tsx:378,404
 *      - config:models.confidenceTier.*, confidenceReason.* —
 *        components/config/ModelPicker.tsx:357,364
 *
 * 2. Explicit `t('ns:key')` namespace-prefixed literal — a real literal call,
 *    but the scanner skips any key containing `:` on purpose (out of scope,
 *    see usedKeysInSource() in locale-rules.mjs):
 *      - collab:yourProjects, sharedWithYou, leaveProject, leaveConfirm*,
 *        leaveFailed, activity.{triggeredBy,you,formerMember},
 *        routing.{scopeNote,loading,loadFailed,retry},
 *        locks.{readOnlyLanguage,compareTargetsScoped,reviewLanguagesScoped,
 *        glossaryEditScoped} — components/layout/Sidebar.tsx,
 *        components/layout/AppShell.tsx, components/comparison/ComparisonTab.tsx,
 *        components/review/ReviewTab.tsx, components/tabs/RunsTab.tsx,
 *        components/sharing/InvitesSection.tsx,
 *        components/string-table/StringTableEditor.tsx,
 *        components/glossary/GlossaryTab.tsx, hooks/use-nickname-labels.ts
 *      - errors:http.* — lib/utils.ts:55-58,106,109
 *        (`HTTP_ERROR_KEYS` map + `t('errors:http.offline')`)
 *
 * 3. "labelKey" indirection — a data table holds the bare key string in a
 *    `labelKey` field; a separate render site calls `t(item.labelKey)` (or
 *    `t(labelKey)`), so the key never appears next to a `t(` call at all:
 *      - sidebar:groups.*, settings, changelog, legal, aboutNarn —
 *        components/layout/Sidebar.tsx (NAV_GROUPS/NAV_ITEMS, rendered
 *        at lines 773, 811, 814)
 *      - legal:* — components/legal/legal-links.ts (LEGAL_PAGES),
 *        components/legal/LegalView.tsx:22
 *      - strings:guide.group*, guide.topic* —
 *        components/guide/guides-registry.ts, components/guide/GuideView.tsx:86
 *      - colorText:group* — components/color-text/palettes.ts,
 *        components/color-text/PaletteSection.tsx:79
 *      - generation:field* — components/generation/GenerationContextControls.tsx
 *        (FIELDS, rendered at line 112)
 *      - logs:action.* — lib/log-presentation/actions.ts (`labelKey` param
 *        threaded through `openTab`/`openGlobalConfig`/`unlockVault`),
 *        components/layout/ConsoleLogRow.tsx:109
 *      - vault:policy* — lib/password-policy.ts (`POLICY_KEY_BY_MESSAGE`,
 *        `translatePolicyMessage()`), consumed by
 *        components/vault/VaultEditorDialog.tsx:224
 *      - backup:trigger* — components/backup/BackupTab.tsx (`TRIGGER_LABEL_KEYS`,
 *        rendered at line 284)
 *
 * 4. The entire `logs:*` namespace (translation.*, lqa.*, judge.*,
 *    sourceReview.*, glossaryGen.*, categoryGen.*, stageDetails.*, module.*,
 *    vault.*, orphan.*, tm.*, backup.*) is reached through ONE registry:
 *    `lib/log-presentation/registry.ts`'s `LOG_PRESENTERS` map, whose `key`
 *    field (a string or a function of the log metadata) is resolved and
 *    passed to `t(key, vars)` in `lib/log-presentation/present.ts:17` and
 *    `lib/log-presentation/group.ts:38`. This also explains the `_other`
 *    plural siblings (translation.queued_other, translation.failedNoRoute_other,
 *    translation.failedModuleDisabled_other, translation.failedModuleNotFound_other,
 *    sourceReview.done_other, orphan.detected_other): the registry's `vars()`
 *    for those events supplies `count`, so i18next appends the plural suffix
 *    itself to the bare key coming out of the registry — the same
 *    bare-key-plus-count mechanism `BARE_KEY_SUFFIXES` models for a literal
 *    call, just fed a variable instead.
 *
 * 5. Ternary-selected literal, still not a scanner-visible single-quoted
 *    key because it sits behind a conditional expression:
 *      - config:routing.achievementName / achievementDescription —
 *        components/batch/BatchConfigEditor.tsx:737-740
 *        (`t(opt === 'name' ? 'routing.achievementName' : 'routing.achievementDescription')`)
 *      - config:modulesEnabledSection / modulesDisabledSection —
 *        components/config/ModuleSettingsPanel.tsx:715,767-778
 *        (`headingKey` field on a section-heading row, `t(item.headingKey, …)`)
 *
 * Add to this list, with the call site, whenever a hit is investigated and
 * found to be a computed-lookup false positive rather than dead. That is
 * what stops the next run (or the next person) re-deriving the same answer.
 * ---------------------------------------------------------------------------
 */
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BARE_KEY_SUFFIXES,
  MIN_SOURCE_FILES,
  REFERENCE_LOCALE,
  flattenEntries,
  loadLocales,
  readSourceFiles,
  usedKeysInSource,
} from './locale-rules.mjs';

// Same resolution strategy as check-locales.mjs: from this script's own
// location, not cwd, so `node scripts/…` and `pnpm i18n:unused` from
// anywhere in the workspace read the same tree.
const FRONTEND_SRC_DIR = fileURLToPath(new URL('../packages/frontend/src', import.meta.url));
const LOCALES_DIR = join(FRONTEND_SRC_DIR, 'locales');

const locales = loadLocales(LOCALES_DIR);
const reference = locales.get(REFERENCE_LOCALE);
if (!reference) {
  console.error(`i18n-unused-keys: reference locale "${REFERENCE_LOCALE}" not found`);
  process.exit(1);
}

const sources = readSourceFiles(FRONTEND_SRC_DIR);

// namespace -> Set of bare keys referenced by a statically analysable t()
// call anywhere in the frontend source. Built once, over every file, rather
// than per-namespace, because a call site's namespace comes from its own
// useTranslation() binding and may not match the namespace being checked.
const usedByNamespace = new Map();
for (const source of sources.values()) {
  for (const { namespace, key } of usedKeysInSource(source)) {
    let used = usedByNamespace.get(namespace);
    if (!used) {
      used = new Set();
      usedByNamespace.set(namespace, used);
    }
    used.add(key);
  }
}

/**
 * Is this flattened locale key reachable from a tracked t() call? Mirrors
 * namespaceHasKey() in locale-rules.mjs, inverted: that function asks
 * "does a bare used-key resolve to something in the locale", tolerating a
 * plural/ordinal suffix on the LOCALE side; this asks "is this locale key
 * (base or suffixed) the target of some used bare key", so the same
 * suffix list applies to the same side of the comparison, just walked in
 * the opposite direction.
 */
function isReachable(namespace, key, used) {
  if (!used) return false;
  if (used.has(key)) return true;
  for (const suffix of BARE_KEY_SUFFIXES) {
    if (key.endsWith(suffix)) {
      const base = key.slice(0, -suffix.length);
      if (base && used.has(base)) return true;
    }
  }
  return false;
}

const hits = [];
for (const [namespace, data] of [...reference].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
  const used = usedByNamespace.get(namespace);
  for (const [key, value] of flattenEntries(data)) {
    if (typeof value !== 'string') continue; // non-string leaves are check-locales's finding
    if (isReachable(namespace, key, used)) continue;
    hits.push(`${namespace}:${key} — "${value}"`);
  }
}

if (sources.size < MIN_SOURCE_FILES) {
  console.error(
    `i18n-unused-keys: FAILED — only ${sources.size} source file(s) found under ` +
      `${FRONTEND_SRC_DIR}, expected at least ${MIN_SOURCE_FILES}. A sweep that reads almost ` +
      `nothing reports almost no offenders, which looks exactly like a clean run — this is the ` +
      `same self-check check-locales.mjs's used-key rule carries, for the same reason.`,
  );
  process.exit(1);
}

if (hits.length > 0) {
  console.log('i18n-unused-keys: keys with no reachable static call site (verify before removing):');
  console.log(`  ${hits.join('\n  ')}`);
} else {
  console.log('i18n-unused-keys: no unreached keys found.');
}

console.log(
  `i18n-unused-keys: ${hits.length} hit(s) across ${reference.size} namespaces, ` +
    `${sources.size} source files scanned`,
);
