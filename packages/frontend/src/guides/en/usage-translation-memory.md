# Translation Memory

## Overview

**Translation Memory** (TM) is a workspace-wide store of known translations. When a string's source text matches one already in memory, the stored translation is reused automatically instead of calling a paid module — saving time and cost and keeping identical text consistent across projects. Open the **Translation Memory** view from the sidebar to browse and search stored segments.

> **Translation Memory is disabled by default** for every project. While it is disabled, nothing a project translates is written to memory and no stored translation is auto-applied. To turn it on, open the project's **Config** tab and pick a reuse policy in the **Translation Memory** section (any value other than *Disabled*).

## How entries get into memory

* **Approve to memory** — in the **Translations** tab, select translations and approve them; they are recorded as trusted segments.
* Completed translations are also recorded so identical source text can reuse them later.

## Reuse policy

The reuse policy (in the project's **Config** tab, **Translation Memory** section) controls *whether* and *when* a stored translation is reused for identical source text. It defaults to **Disabled** (TM off); other choices — for example **Strict (full context match)**, which only reuses when the surrounding context matches too — turn it on. Tightening the policy avoids reusing a translation that was correct in one place but not another.

## Controlling reuse per run

When you start a translation from the **Compare** tab's *Translate…* dialog, a notice tells you how many entries would be filled from memory, and you can **disable memory for this run** to force every entry to be freshly translated — useful when you want the model to reconsider previously memorized text.
