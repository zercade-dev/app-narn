#!/usr/bin/env node
/**
 * Release prep: bump the app version and consolidate the unreleased changelog
 * fragments into that version's entry.
 *
 *   node scripts/release-prep.mjs 1.60.0        (usually via `make release-prep VERSION=…`)
 *
 * Run this on `develop`, as its own commit, immediately before merging
 * `develop -> main`. The merge is the release: it promotes the digest develop
 * already built and smoked, cuts `vX.Y.Z`, and publishes release notes read from
 * the file this script writes.
 *
 * Deliberately does NOT commit, tag, or push — the caller stages the result, so a
 * bad consolidation is just an unstaged diff rather than something to revert.
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CHANGELOG_DIR = 'packages/frontend/src/guides/en/changelog';
const UNRELEASED_DIR = join(CHANGELOG_DIR, 'unreleased');
const PKG = 'package.json';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`usage: node scripts/release-prep.mjs <x.y.z>\ngot: ${version ?? '(nothing)'}`);
  process.exit(1);
}

const target = join(CHANGELOG_DIR, `v${version}.md`);

// Fragments, in stable alphabetical order so a re-run produces identical output.
const fragments = readdirSync(UNRELEASED_DIR)
  .filter((f) => f.endsWith('.md') && f !== 'README.md')
  .sort();

if (fragments.length === 0) {
  console.error(
    `No fragments in ${UNRELEASED_DIR}. A release with no user-visible changes has\n` +
      `nothing to announce — add a fragment, or bump the version by hand if this is\n` +
      `deliberately a dependency-only release.`,
  );
  process.exit(1);
}

// Refuse to clobber an existing entry: published versions are immutable, and a
// silently-overwritten changelog would desync the release notes from the image.
try {
  readFileSync(target, 'utf8');
  console.error(`${target} already exists — pick a new version, or delete it deliberately.`);
  process.exit(1);
} catch (err) {
  if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'ENOENT') throw err;
}

/**
 * Longest highlight across every entry written before the format drifted (v1.32.0
 * and earlier) was 160 characters; the drifted ones ran to 1291. 180 leaves the
 * legacy shape room to breathe while still rejecting a paragraph.
 */
const MAX_HIGHLIGHT = 180;

const HEADING_RE = /^#{1,6}\s/;
const BULLET_RE = /^[-*]\s/;

/**
 * Shape guard for the fragments about to become an immutable published entry.
 *
 * `ChangelogView` renders an entry as a bold one-line *highlight* — the first block
 * after the `## vX.Y.Z — DATE` header — plus *detail bullets*, everything after it.
 * The highlight is emitted as plain text (`splitEntry` extracts it, and it never
 * reaches the markdown renderer), so two fragment shapes break the page:
 *
 *  - **A leading heading** becomes the highlight, and its `###` markers render
 *    literally. This shipped once, in v1.64.0.
 *  - **A long opening paragraph** becomes a wall of bold text, and the collapsed
 *    "older releases" list — one `version · highlight` line per release — stops
 *    being one line per release.
 *
 * A third rule is the markdown renderer's own: its list parser consumes only
 * consecutive lines that themselves start with a bullet, so a hard-wrapped bullet
 * silently ends the list and turns its own tail into a paragraph.
 *
 * Fragments are consolidated in filename order and any of them can sort first, so
 * every fragment is checked rather than only the one that happens to lead.
 */
function fragmentProblems(md) {
  const problems = [];
  const lines = md.split('\n');

  if (HEADING_RE.test(lines[0])) {
    problems.push('starts with a heading — write the body only, with no heading (see README.md)');
  }

  const opening = [];
  for (const line of lines) {
    if (line.trim() === '' || BULLET_RE.test(line)) break;
    opening.push(line.trim());
  }
  const highlight = opening.join(' ');
  if (highlight.length > MAX_HIGHLIGHT) {
    problems.push(
      `opening paragraph is ${highlight.length} characters; the highlight must be one ` +
        `short sentence (max ${MAX_HIGHLIGHT}). Lead with a one-line summary, then put ` +
        `the detail in "- " bullets.`,
    );
  }

  for (let i = 0; i < lines.length - 1; i++) {
    if (!BULLET_RE.test(lines[i])) continue;
    const next = lines[i + 1];
    if (next.trim() === '' || BULLET_RE.test(next)) continue;
    problems.push(
      `line ${i + 2} continues the bullet on line ${i + 1}; keep each bullet on a ` +
        `single line, or the renderer ends the list there and turns the rest into a paragraph.`,
    );
  }

  return problems;
}

const texts = fragments.map((f) => ({
  file: f,
  md: readFileSync(join(UNRELEASED_DIR, f), 'utf8').trim(),
}));

const flagged = texts
  .map(({ file, md }) => ({ file, problems: fragmentProblems(md) }))
  .filter(({ problems }) => problems.length > 0);

if (flagged.length > 0) {
  console.error(
    `Refusing to consolidate: ${flagged.length} fragment(s) do not match the changelog\n` +
      `entry format. A published entry cannot be corrected without rewriting history,\n` +
      `so the shape is checked here, before it lands.\n`,
  );
  for (const { file, problems } of flagged) {
    console.error(`${join(UNRELEASED_DIR, file)}`);
    for (const p of problems) console.error(`  ${p}`);
  }
  console.error(`\nrelease-prep aborted. Nothing was written or deleted.`);
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const body = texts
  .map(({ md }) => md)
  .filter(Boolean)
  .join('\n\n');

writeFileSync(target, `## v${version} — ${date}\n\n${body}\n`);
for (const f of fragments) rmSync(join(UNRELEASED_DIR, f));

// Narrow, anchored replace: a loose /"version": "..."/ would match the first such
// key anywhere in the manifest.
const pkg = readFileSync(PKG, 'utf8');
const bumped = pkg.replace(/^(\s*"version":\s*)"[^"]+"/m, `$1"${version}"`);
if (bumped === pkg) {
  console.error(`Could not find a top-level "version" key to bump in ${PKG}.`);
  process.exit(1);
}
writeFileSync(PKG, bumped);

console.log(`v${version} — consolidated ${fragments.length} fragment(s) into ${target}`);
for (const f of fragments) console.log(`  - ${f}`);
console.log(`Bumped ${PKG} to ${version}. Review the diff, then commit and merge to main.`);
