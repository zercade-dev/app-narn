// Aggregated third-party licence file for the built frontend.
//
// WHY this exists: the build strips every comment from its output (see
// comments.mjs and the `strip-comments` plugin in vite.config.ts), so the
// `@license` banners and copyright headers that ordinarily ride along inside
// library source do not survive into dist/. The permissive licences those
// libraries carry (MIT, ISC, BSD, Apache-2.0, OFL) require their copyright and
// permission notices to travel with copies. This plugin emits those notices
// beside the bundle, as dist/LICENSES.txt, instead of weakening the stripping.
//
// WHERE THE PACKAGE SET COMES FROM: the bundle itself, never a manifest. A
// manifest-derived list answers "what did we declare", which is a different
// question and has already been wrong once — `pnpm licenses list --prod` hides
// development dependencies, and six font families went unattributed because of
// it. Here the inputs are the module ids the bundler actually placed in the
// emitted chunks, the module graph behind them, and the source paths of every
// emitted asset (which is how font binaries and the CSS that references them
// are caught). Anything under a node_modules directory is resolved back to its
// owning package and attributed. The one thing this cannot see is the CSS
// pipeline — see CSS_PIPELINE_PACKAGES below.
//
// WHERE THE TEXT COMES FROM: each package's own licence file, read verbatim
// from the installed directory. Licence texts are not synthesised from an SPDX
// template — the copyright lines inside them are the operative content and
// differ per package.
//
// WHAT HAPPENS WHEN A PACKAGE SHIPS NO LICENCE FILE: it is listed, by name and
// version, in a clearly marked section at the end of the emitted file together
// with the identifier its manifest declares. Silence is the failure mode this
// avoids. A package that offers neither a licence file nor a declared licence
// is unattributable, and fails the build.

import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/** Emitted file name, relative to the build's output directory. */
export const LICENSES_FILE_NAME = 'LICENSES.txt';

/**
 * Packages whose code ships in the built stylesheet but which the module graph
 * cannot see, named here because there is no way to discover them.
 *
 * `src/index.css` opens with `@import 'tailwindcss'` and
 * `@import 'shadcn/tailwind.css'`. Tailwind resolves both itself, inside its
 * own vite plugin, and hands back finished CSS — so neither package ever
 * becomes a module in the bundler's graph, and neither appears among the
 * emitted assets' source paths. Their CSS is nonetheless in the stylesheet
 * that ships.
 *
 * This is a named list rather than a derived one, which is exactly the shape
 * that went wrong before, so it is bounded to make the failure loud: each name
 * must resolve to an installed package at build time, its licence is read from
 * that package's own directory like every other, and a name that no longer
 * resolves fails the build instead of quietly dropping out. What it cannot
 * catch is a NEW stylesheet import — add one, and add it here.
 */
export const CSS_PIPELINE_PACKAGES = ['tailwindcss', 'shadcn'];

/**
 * Licence-bearing file names, in preference order. Matched case-insensitively
 * against the whole file name, with any extension: packages ship `LICENSE`,
 * `LICENSE.md`, `LICENSE.txt`, the British spelling, `COPYING`, and sometimes
 * several at once (a dual-licensed package may carry `LICENSE-MIT` and
 * `LICENSE-APACHE`), so every match is reproduced, ordered by this list.
 */
const LICENCE_FILE_PATTERNS = [
  /^licen[cs]e(\b|[-._]|$)/i,
  /^copying(\b|[-._]|$)/i,
  /^notice(\b|[-._]|$)/i,
];

/**
 * Extensions that make a name-matching file code or data rather than a notice:
 * a `license-check.js` helper or a `license.json` index is not licence text.
 */
const LICENCE_FILE_EXCLUDE = /\.(js|jsx|mjs|cjs|ts|tsx|mts|cts|json|map|lock|ya?ml)$/i;

/** Largest licence file worth reading; guards against a stray huge match. */
const MAX_LICENCE_BYTES = 256 * 1024;

/**
 * Strip the decorations a bundler hangs off a module id — vite's `?used` /
 * `?inline` style queries, its `\0` virtual-module prefix and `/@fs/` prefix,
 * Windows-style separators — and resolve the result to an absolute path.
 *
 * Resolving matters: chunk module ids are absolute, but an emitted asset's
 * source path is relative to the build root (`../../node_modules/.pnpm/…`).
 * Left alone, the same package arrives under two different strings and is
 * attributed twice.
 *
 * Returns null for anything that is not a real filesystem path (virtual
 * modules, `data:` urls, http imports).
 */
export function normalizeModulePath(id, root = process.cwd()) {
  if (typeof id !== 'string' || id.length === 0) return null;
  let path = id;
  if (path.startsWith('\0')) return null;
  if (/^[a-z]+:/i.test(path) && !/^[a-z]:[\\/]/i.test(path)) return null; // data:, http:, virtual:
  path = path.replace(/[?#].*$/, '');
  if (path.startsWith('/@fs/')) path = path.slice('/@fs'.length);
  path = path.split('\\').join('/');
  if (path.length === 0) return null;
  return isAbsolute(path) ? path : resolve(root, path);
}

/**
 * Resolve a file path inside node_modules to the directory of the package that
 * owns it.
 *
 * Walking up to the nearest package.json is not enough on its own: plenty of
 * packages drop a bare `{"type":"module"}` package.json into a subdirectory,
 * and stopping there would attribute the file to a nameless package. So the
 * walk continues until it finds a manifest carrying a `name`, and stops at the
 * node_modules boundary. This is also what makes pnpm's layout work — the real
 * path of a dependency is `.../node_modules/.pnpm/react@19.2.8/node_modules/react/…`,
 * and the last `node_modules` segment is the one that matters.
 */
export function packageDirForPath(path) {
  const marker = '/node_modules/';
  const at = path.lastIndexOf(marker);
  if (at === -1) return null;
  const boundary = path.slice(0, at + marker.length - 1);
  let dir = dirname(path);
  while (dir.length > boundary.length && dir.startsWith(boundary)) {
    const manifest = readManifest(dir);
    if (manifest && typeof manifest.name === 'string' && manifest.name.length > 0) {
      return { dir, manifest };
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function readManifest(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** The SPDX-ish identifier a manifest declares, across the historical shapes. */
function declaredLicense(manifest) {
  const { license, licenses } = manifest;
  if (typeof license === 'string' && license.trim()) return license.trim();
  if (license && typeof license === 'object' && typeof license.type === 'string') {
    return license.type.trim();
  }
  if (Array.isArray(licenses)) {
    const types = licenses
      .map((entry) => (typeof entry === 'string' ? entry : entry?.type))
      .filter((type) => typeof type === 'string' && type.trim());
    if (types.length > 0) return types.join(' OR ');
  }
  return null;
}

/**
 * Every licence-bearing file in a package directory, read verbatim.
 * @returns {Array<{file: string, text: string}>}
 */
export function readLicenceFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const matches = [];
  for (const name of entries) {
    if (LICENCE_FILE_EXCLUDE.test(name)) continue;
    const rank = LICENCE_FILE_PATTERNS.findIndex((pattern) => pattern.test(name));
    if (rank === -1) continue;
    const full = join(dir, name);
    try {
      const stat = statSync(full);
      if (!stat.isFile() || stat.size === 0 || stat.size > MAX_LICENCE_BYTES) continue;
      const text = readFileSync(full, 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
      if (text.trim().length === 0) continue;
      matches.push({ file: name, text, rank });
    } catch {
      // Unreadable entry: treated as absent, and reported as such downstream.
    }
  }
  matches.sort((a, b) => a.rank - b.rank || a.file.localeCompare(b.file));
  return matches.map(({ file, text }) => ({ file, text }));
}

/** Canonical form of a directory: symlinks resolved, so pnpm's two views of a
 * package (the `node_modules/<name>` link and the `.pnpm/…` store path) collapse
 * to one entry. Falls back to the given path if it cannot be resolved. */
function canonicalDir(dir) {
  try {
    return realpathSync.native(dir);
  } catch {
    return dir;
  }
}

/**
 * Find an installed package by name, searching `node_modules` in `from` and
 * each of its ancestors — the resolution order node itself uses, which is what
 * makes it work for both a package hoisted to the workspace root and one
 * installed beside the importing package.
 */
export function findInstalledPackage(name, from) {
  let dir = resolve(from);
  for (;;) {
    const candidate = join(dir, 'node_modules', name);
    const manifest = readManifest(candidate);
    if (manifest && manifest.name === name) return { dir: candidate, manifest };
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Build the per-package record: identity, provenance, and its licence texts. */
function describePackage(dir, manifest, via) {
  return {
    name: manifest.name,
    version: typeof manifest.version === 'string' ? manifest.version : 'unknown',
    declared: declaredLicense(manifest),
    homepage:
      typeof manifest.homepage === 'string'
        ? manifest.homepage
        : typeof manifest.repository === 'string'
          ? manifest.repository
          : typeof manifest.repository?.url === 'string'
            ? manifest.repository.url
            : null,
    via,
    dir,
    files: readLicenceFiles(dir),
  };
}

/**
 * Turn the set of paths that shipped into the build into attributed packages.
 *
 * @param {Iterable<string>} paths source paths of bundled modules and assets
 * @param {{root?: string, cssPipelinePackages?: string[]}} [options]
 * @returns {{attributed: Array<object>, undocumented: Array<object>,
 *            unattributable: Array<object>, missing: string[]}}
 */
export function collectPackages(paths, options = {}) {
  const root = options.root ?? process.cwd();
  const named = options.cssPipelinePackages ?? CSS_PIPELINE_PACKAGES;

  const seen = new Map();
  for (const raw of paths) {
    const path = normalizeModulePath(raw, root);
    if (!path) continue;
    const found = packageDirForPath(path);
    if (!found) continue;
    const key = canonicalDir(found.dir);
    if (!seen.has(key)) seen.set(key, describePackage(key, found.manifest, 'bundle'));
  }

  const missing = [];
  for (const name of named) {
    const found = findInstalledPackage(name, root);
    if (!found) {
      missing.push(name);
      continue;
    }
    const key = canonicalDir(found.dir);
    if (!seen.has(key)) seen.set(key, describePackage(key, found.manifest, 'stylesheet'));
  }

  const attributed = [];
  const undocumented = [];
  const unattributable = [];
  for (const record of seen.values()) {
    if (record.files.length > 0) attributed.push(record);
    else if (record.declared) undocumented.push(record);
    else unattributable.push(record);
  }

  const byName = (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
  attributed.sort(byName);
  undocumented.sort(byName);
  unattributable.sort(byName);
  return { attributed, undocumented, unattributable, missing };
}

const RULE = '='.repeat(78);
const THIN_RULE = '-'.repeat(78);

/** Render the emitted file. Pure string work, so it is testable on its own. */
export function renderLicencesFile({ attributed, undocumented }, options = {}) {
  const appName = options.appName ?? 'NARN';
  const total = attributed.length + undocumented.length;
  const stylesheet = [...attributed, ...undocumented].filter((pkg) => pkg.via === 'stylesheet');
  const out = [];

  out.push(RULE);
  out.push(`Third-party licences for the ${appName} frontend build`);
  out.push(RULE);
  out.push('');
  out.push(
    wrap(
      `This build bundles code, styles and font binaries from ${total} third-party ` +
        `packages. The build strips every comment from its output, so the licence ` +
        `banners those packages carry in their own source do not survive into the ` +
        `JavaScript and CSS beside this file. Their notices are reproduced here ` +
        `instead, and this file is part of the build output: it accompanies the ` +
        `bundle wherever the bundle goes, including inside the container image.`,
    ),
  );
  out.push('');
  out.push(
    wrap(
      `The package list is derived from the bundle itself — the modules the ` +
        `bundler placed in the emitted chunks, the module graph behind them, and ` +
        `the sources of every emitted asset — not from any dependency manifest, ` +
        `so it covers development dependencies whose output ships just as it ` +
        `covers production ones. Each licence text below is reproduced verbatim ` +
        `from a file in that package's own installed directory; none of it is ` +
        `generated from an identifier or a template.`,
    ),
  );
  out.push('');
  if (stylesheet.length > 0) {
    out.push(
      wrap(
        `Two entries are the exception, marked [stylesheet] below: ` +
          `${stylesheet.map((pkg) => pkg.name).join(' and ')} are imported by the ` +
          `application stylesheet and resolved inside the CSS pipeline, so their ` +
          `output ships without their ever becoming modules the bundler can ` +
          `report. They are named explicitly in the build for that reason; their ` +
          `licence texts are read from the installed packages like every other.`,
      ),
    );
    out.push('');
  }
  out.push(
    wrap(
      `Not covered: code the bundler itself generates or injects — its ` +
        `module-preload helper, for instance — belongs to no bundled package ` +
        `directory and cannot be attributed by this method. ` +
        `${appName}'s own source, and the licence it is published under, are not ` +
        `listed here either; see the LICENSE file in the source repository.`,
    ),
  );
  out.push('');
  out.push(`Generated by the ${appName} build. Do not edit by hand.`);
  out.push('');

  out.push(RULE);
  out.push(`Contents (${total} packages)`);
  out.push(RULE);
  out.push('');
  for (const pkg of attributed) {
    out.push(`  ${pkg.name}@${pkg.version}${declaredSuffix(pkg)}${viaSuffix(pkg)}`);
  }
  for (const pkg of undocumented) {
    out.push(
      `  ${pkg.name}@${pkg.version}${declaredSuffix(pkg)}${viaSuffix(pkg)}` +
        `  [no licence file shipped]`,
    );
  }
  out.push('');

  for (const pkg of attributed) {
    out.push(RULE);
    out.push(`${pkg.name}@${pkg.version}${viaSuffix(pkg)}`);
    if (pkg.declared) out.push(`Declared licence: ${pkg.declared}`);
    if (pkg.homepage) out.push(`Homepage: ${pkg.homepage}`);
    out.push(RULE);
    for (const file of pkg.files) {
      out.push('');
      out.push(`--- ${file.file} ---`);
      out.push('');
      out.push(file.text);
    }
    out.push('');
  }

  if (undocumented.length > 0) {
    out.push(RULE);
    out.push('Packages that ship no licence file');
    out.push(RULE);
    out.push('');
    out.push(
      wrap(
        `The following bundled packages carry no licence file in their published ` +
          `tarball, so no text can be reproduced for them. Each declares the ` +
          `licence named beside it in its own package manifest; the full text is ` +
          `the standard text of that licence, held by the copyright holder named ` +
          `in the package's source repository. They are listed here rather than ` +
          `omitted, so that what is missing is visible.`,
      ),
    );
    out.push('');
    for (const pkg of undocumented) {
      out.push(`  ${pkg.name}@${pkg.version} — declares ${pkg.declared}`);
      if (pkg.homepage) out.push(`      ${pkg.homepage}`);
    }
    out.push('');
  }

  out.push(THIN_RULE);
  out.push(`End of third-party licences (${total} packages).`);
  out.push('');
  return out.join('\n');
}

function declaredSuffix(pkg) {
  return pkg.declared ? ` — ${pkg.declared}` : '';
}

function viaSuffix(pkg) {
  return pkg.via === 'stylesheet' ? '  [stylesheet]' : '';
}

/** Hard-wrap prose at 78 columns so the file reads in a plain terminal. */
function wrap(text, width = 78) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * Every path that contributed to the emitted bundle: the module ids inside each
 * chunk, the whole module graph the bundler resolved, and the original source
 * paths of every emitted asset (fonts, images, and the CSS they are referenced
 * from). Collected from three angles deliberately — a package missed by one is
 * usually caught by another, and over-collecting only costs a duplicate that
 * the package-level de-duplication removes.
 */
export function bundleSourcePaths(bundle, context) {
  const paths = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value.length > 0) paths.add(value);
  };

  for (const file of Object.values(bundle ?? {})) {
    if (file?.type === 'chunk') {
      for (const id of Object.keys(file.modules ?? {})) add(id);
      for (const id of file.moduleIds ?? []) add(id);
      add(file.facadeModuleId);
    } else if (file?.type === 'asset') {
      for (const name of file.originalFileNames ?? []) add(name);
      add(file.originalFileName);
    }
  }

  if (typeof context?.getModuleIds === 'function') {
    try {
      for (const id of context.getModuleIds()) add(id);
    } catch {
      // A bundler without a traversable graph still leaves the chunk ids above.
    }
  }

  return paths;
}

/**
 * The vite plugin. Emits LICENSES.txt into the output directory alongside the
 * bundle, and fails the build if a bundled package can be attributed to
 * neither a licence file nor a declared licence.
 */
export function emitLicensesPlugin(options = {}) {
  let root = options.root ?? process.cwd();
  return {
    name: 'emit-licenses',
    apply: 'build',
    configResolved(config) {
      // Asset source paths are relative to the build root, so the resolved
      // root — not the process's working directory, which differs between a
      // package-level build and a workspace-wide one — is what makes them
      // resolvable.
      if (typeof config?.root === 'string' && config.root.length > 0) root = config.root;
    },
    generateBundle(_outputOptions, bundle) {
      const paths = bundleSourcePaths(bundle, this);
      const collected = collectPackages(paths, { ...options, root });
      const { attributed, undocumented, unattributable, missing } = collected;

      if (missing.length > 0) {
        throw new Error(
          `emit-licenses: the stylesheet-pipeline package(s) ${missing.join(', ')} are named ` +
            `in build/licenses.mjs but are not installed, so their notices cannot be read. ` +
            `If their CSS no longer ships, remove them from CSS_PIPELINE_PACKAGES; ` +
            `otherwise install them.`,
        );
      }
      if (unattributable.length > 0) {
        const named = unattributable.map((pkg) => `${pkg.name}@${pkg.version} (${pkg.dir})`);
        throw new Error(
          `emit-licenses: ${unattributable.length} bundled package(s) have neither a ` +
            `licence file nor a licence declared in their manifest, so their notices ` +
            `cannot be reproduced: ${named.join(', ')}`,
        );
      }
      if (attributed.length + undocumented.length === 0) {
        throw new Error(
          'emit-licenses: no bundled third-party packages were found. The bundle format ' +
            'changed and the module ids are no longer reachable — an empty licence file ' +
            'would be worse than none, so this fails instead.',
        );
      }

      const source = renderLicencesFile(collected, options);
      this.emitFile({ type: 'asset', fileName: LICENSES_FILE_NAME, source });

      const note =
        undocumented.length > 0
          ? `, ${undocumented.length} of them with no licence file to reproduce`
          : '';
      const label = options.appName ?? 'NARN';
      this.info?.(
        `${LICENSES_FILE_NAME}: ${attributed.length + undocumented.length} ${label} ` +
          `bundled packages${note}`,
      );
    },
  };
}
