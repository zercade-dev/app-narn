# Backup Tab

## Overview

The **Backup** tab packs a project — its config, entries, and glossary — into a verifiable `.zip` archive. Every file is checksummed, and checksums are verified before anything is written back on restore.

## Creating a backup

1. Select a project.
2. Open the **Backup** tab.
3. Click **Create Backup**.
4. The new archive appears in **Saved backups**, where you can **Download** it.

## Automatic backups

The app also takes safety snapshots for you, listed alongside manual backups:

* **Before a CSV import** — a restore point from just before the import.
* **Before a re-translation** — a restore point from just before entries were overwritten.

Global Config sets **Max backups per project** (default 10); older backups are pruned beyond that.

## Restoring

1. In **Restore from backup**, select a `.zip` (or pick one of the saved backups).
2. The app verifies checksums and shows a preview (project, files, creation time).
3. Confirm. Restoring overwrites the project's current config, entries, and glossary — this cannot be undone, so create a fresh backup first if in doubt.

## Deleting

Use **Delete** on any saved backup to remove that archive from the server permanently.
