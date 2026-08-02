# Orphans Tab

## Overview

The **Orphans** tab lists entries that are no longer present in the most recently imported CSV. They usually appear after a re-import where a row was removed, renamed, or had its source text changed — the old translations are kept here so you don't lose work.

## What you can do

* **Delete** an orphan to permanently remove the record and its translations (this cannot be undone).
* **Relink** an orphan to move its translations onto another entry. Search for the target by source text; existing translations on the target are kept and only its empty languages are filled.
* Select several orphans and **Delete selected** in bulk, or **Refresh** the list.

## Workflow

1. Re-import your source CSV from the **Config** tab.
2. Open **Orphans** and review what dropped out.
3. **Relink** any entry whose id or source text changed but whose translations are still valid.
4. **Delete** entries that are genuinely gone.

When the list is empty, every imported entry matches the current project — nothing is orphaned.
