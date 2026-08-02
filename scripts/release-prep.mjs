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

const date = new Date().toISOString().slice(0, 10);
const body = fragments
  .map((f) => readFileSync(join(UNRELEASED_DIR, f), 'utf8').trim())
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
