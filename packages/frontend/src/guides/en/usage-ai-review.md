# AI Review

## Overview

Beyond the automatic LQA checks, the app can use an AI model to review your content. There are two AI review tabs plus a manual review queue. All AI review needs an LLM module enabled in **Global Config** and the credential vault unlocked.

## Translation AI review

The **Translation AI review** tab has an AI judge score completed translations for **accuracy, fluency, terminology, and tone**.

* Click **Review last run** to judge the latest completed translation run (or start a review from a specific run in the **Activity** tab).
* Step through the flagged results; each verdict shows the source, the translation, a **score**, and often a **suggestion**.
* **Apply** a suggestion to replace the translation, or **Approve all suggestions** to apply them in one pass. A warning appears if a suggestion would drop tags, placeholders, or line breaks.

## Source AI review

The **Source AI review** tab checks the **source text itself** — it is report-only and never changes translations.

1. Choose the checks to run: **typo**, **grammar**, **terminology**, **clarity**, and **unsafe** content.
2. Pick the **module** and **model**, and optionally the **reply language** for the findings.
3. Click **Start review**. It runs in the background — watch progress in the **Activity** tab.
4. Review each finding and **Approve** or **Ignore** it; a suggested source rewrite can be copied.

## Manual review

The **Manual review** tab is a human review queue. Translations marked **Needs review** (or **Flagged**) appear here, where you can **Approve**, **Edit**, **Flag**, **Re-translate**, or request a **back-translation** to the source as a reference. Keyboard shortcuts speed it up: `↑`/`↓` to move, `a` to approve, `e` to edit.
