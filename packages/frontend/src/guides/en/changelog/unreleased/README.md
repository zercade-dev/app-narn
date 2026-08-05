# Unreleased changelog fragments

One file per user-visible change, added in the same commit as the change itself.
Name it after the change (`text-styler-proposals.md`, `csv-export-fix.md`).

**Write the body only — no heading.** `make release-prep VERSION=x.y.z` concatenates
every fragment here into `../vx.y.z.md` under a single `## vx.y.z — <date>` heading,
deletes the fragments, and that same text becomes the GitHub release notes.

## Structure: one short lead sentence, then bullets

```markdown
Watch your translations progress live, with a real progress bar.

- Translation and review runs now show a progress bar everywhere run progress appears.
- Progress updates arrive the moment each batch of translations comes back.
- Runs with an unknown size show an animated bar while they get going.
```

This is not cosmetic. The Changelog page splits an entry into a **highlight** — the
first block after the header — and **detail bullets**, everything after it. The
highlight is rendered as plain text, and the collapsed "Show older releases" list is
one `version · highlight` line per release. So:

- **Lead with one short sentence** (max 180 characters). A long opening paragraph
  becomes a wall of bold text, and turns the one-line older-release rows into
  paragraphs.
- **No heading, anywhere in the fragment.** A leading heading becomes the highlight,
  and because the highlight never reaches the markdown renderer its `###` markers
  show up literally on the page.
- **Keep each bullet on a single line.** The renderer's list parser only consumes
  consecutive lines that start with `- `, so a hard-wrapped bullet ends the list
  early and turns its own tail into a paragraph.

`make release-prep` enforces all three and refuses to consolidate otherwise —
a published entry can't be corrected without rewriting history.

Tone: public and non-technical, matching the existing `v*.md` entries — what changed
and why it matters to someone using narn, not how it was implemented. Never mention
security internals.

Dependency bumps and internal refactors add **no** fragment.

This directory is invisible to the in-app changelog: `components/guide/changelog-registry.ts`
globs `changelog/*.md`, and `*` does not cross `/`.
