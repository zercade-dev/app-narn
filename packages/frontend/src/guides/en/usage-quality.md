# Quality Tab

## Overview

The **Quality** tab is a dashboard that aggregates the LQA (Linguistic Quality Assurance) results produced whenever entries are translated. It shows your overall pass rate and where issues cluster, so you can find problem areas quickly. It fills in as you translate — if it is empty, run a translation first.

## What it shows

* **Overall pass rate** across all LQA results and the entries they cover.
* **Pass rate by language** — quality per target language.
* **Issues by source** — issue-type counts grouped by source-origin label.
* **Quality by module** — pass rate and issues grouped by the module that produced each translation.

## Drilling in

Click any cell to jump to the matching entries — the dashboard filters the **Translations** table down to the affected entries so you can fix them.

## Where the checks come from

Each translation passes through the LQA gate, which runs the checks you enabled in the **Config** tab's *LQA Checks* panel (tag equality, length limit, overflow, glossary adherence, forbidden terms, regex assertions, and more). **Blocking** checks fail the gate and can trigger one automatic retry; **warning** checks are reported here without blocking. Adjust which checks run, and their severity, in Config.
