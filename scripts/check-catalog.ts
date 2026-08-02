#!/usr/bin/env npx tsx
/**
 * check-catalog.ts
 *
 * Lint script that enforces pnpm workspace catalog compliance:
 * 1. Every catalog entry in pnpm-workspace.yaml must be an exact semver version
 *    (no ^, ~, >=, *, latest, etc.)
 * 2. Every dependency in packages/* and modules/* package.json files must
 *    use "catalog:" or "workspace:*" — no hardcoded version ranges.
 *
 * Exits 0 if clean, exits 1 with violation list if any found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, '..');

// ---------------------------------------------------------------------------
// Minimal YAML catalog-block parser
// ---------------------------------------------------------------------------

/**
 * Parses the `catalog:` block from pnpm-workspace.yaml and returns a map of
 * package-name → version string.  Does not depend on any external YAML library.
 */
function parseCatalog(yamlPath: string): Map<string, string> {
  const content = readFileSync(yamlPath, 'utf-8');
  const catalog = new Map<string, string>();
  let inCatalog = false;

  for (const rawLine of content.split('\n')) {
    // Top-level key: starts with a letter or @ (no leading spaces)
    if (/^[a-zA-Z@]/.test(rawLine)) {
      inCatalog = rawLine.trimEnd().startsWith('catalog:');
      continue;
    }
    if (!inCatalog) continue;

    // Strip inline comments (space + hash)
    const commentIdx = rawLine.indexOf(' #');
    const effective = commentIdx >= 0 ? rawLine.slice(0, commentIdx) : rawLine;
    const trimmed = effective.trim();

    // Skip blank lines and full-line comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Skip list items (lines that start with -)
    if (trimmed.startsWith('-')) continue;

    // Match `'@scoped/pkg': version` or `pkg: version`
    const match = trimmed.match(/^['"]?([^'":\s][^'":]*)['"]?\s*:\s*(.+)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, '');
      catalog.set(key, value);
    }
  }

  return catalog;
}

/**
 * Returns true when the version string is an exact semver pin with no range
 * operator.  Pre-release suffixes (e.g. -beta.4) are allowed.
 */
function isExactVersion(v: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9._-]+)?$/.test(v);
}

// ---------------------------------------------------------------------------
// package.json dependency checker
// ---------------------------------------------------------------------------

function findPackageJsonFiles(dirs: string[]): string[] {
  const results: string[] = [];
  for (const dir of dirs) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const pkgPath = join(dir, entry, 'package.json');
      try {
        statSync(pkgPath);
        results.push(pkgPath);
      } catch {
        // Not a package directory or no package.json — skip
      }
    }
  }
  return results;
}

const ALLOWED_DEP_VALUES = new Set(['catalog:', 'workspace:*', 'workspace:^', 'workspace:~']);
const DEP_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function checkPackageJson(pkgPath: string): string[] {
  const violations: string[] = [];
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return [`${pkgPath}: invalid JSON`];
  }

  for (const section of DEP_SECTIONS) {
    const deps = pkg[section] as Record<string, string> | undefined;
    if (!deps) continue;
    for (const [name, value] of Object.entries(deps)) {
      if (!ALLOWED_DEP_VALUES.has(value)) {
        violations.push(
          `${pkgPath}: ${section}.${name} = "${value}" (must be "catalog:" or "workspace:*")`,
        );
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const workspaceYaml = join(ROOT, 'pnpm-workspace.yaml');
const violations: string[] = [];

// 1. Validate catalog entries are exact version pins
const catalog = parseCatalog(workspaceYaml);
for (const [pkg, version] of catalog) {
  if (!isExactVersion(version)) {
    violations.push(
      `pnpm-workspace.yaml catalog: ${pkg}: "${version}" is not an exact version (no ^, ~, >=, *, latest)`,
    );
  }
}

// 2. Validate all workspace package.json dep values use catalog: or workspace:*
const workspaceDirs = [join(ROOT, 'packages'), join(ROOT, 'modules')];
const packageJsonFiles = findPackageJsonFiles(workspaceDirs);
for (const pkgFile of packageJsonFiles) {
  violations.push(...checkPackageJson(pkgFile));
}

// 3. Report results
if (violations.length > 0) {
  console.error('Catalog compliance violations found:\n');
  for (const v of violations) {
    console.error(`  ✗ ${v}`);
  }
  console.error(`\n${violations.length} violation(s). Fix these before committing.`);
  process.exit(1);
} else {
  const pkgCount = packageJsonFiles.length;
  console.log(
    `✓ Catalog compliance OK (${catalog.size} catalog entries, ${pkgCount} package.json files checked)`,
  );
  process.exit(0);
}
