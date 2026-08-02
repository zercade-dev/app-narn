# Unreleased changelog fragments

One file per user-visible change, added in the same commit as the change itself.
Name it after the change (`text-styler-proposals.md`, `csv-export-fix.md`).

**Write the body only — no heading.** `make release-prep VERSION=x.y.z` concatenates
every fragment here into `../vx.y.z.md` under a single `## vx.y.z — <date>` heading,
deletes the fragments, and that same text becomes the GitHub release notes.

Tone: public and non-technical, matching the existing `v*.md` entries — what changed
and why it matters to someone using narn, not how it was implemented. Never mention
security internals.

Dependency bumps and internal refactors add **no** fragment.

This directory is invisible to the in-app changelog: `components/guide/changelog-registry.ts`
globs `changelog/*.md`, and `*` does not cross `/`.
