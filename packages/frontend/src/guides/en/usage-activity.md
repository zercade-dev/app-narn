# Activity Tab

## Overview

The **Activity** tab is the control center for background jobs. Every long-running task surfaces here: **translation** runs, **AI review** (translation and source), **glossary generation**, and **category generation**. Runs are queued and serialized per project, so you can line several up and watch them work through.

## Reading a run

Each run shows its **type**, **status** (Queued, Running, Paused, Completed, Failed, or Cancelled), progress, and an estimated **cost**. Costs are module-reported estimates derived from each model's price per million tokens, so thinking models can show large token totals relative to characters. Use **Show details** to see exactly what a run translated, any retries, and character/token usage. You can copy a run's id for reference.

## Managing the queue

* **Pause** / **Resume** a run, or **Start now** to jump a queued run ahead.
* **Move up** / **Move down** to reorder the queue.
* **Cancel** a run that is queued or in progress.

## Recovering and reviewing

* If some strings failed, **Retry failed** re-runs just those.
* On a completed translation run, start an **AI review** directly from the run — choose the module and model (it defaults to the ones used for the translation), then open the verdicts in the **Translation AI review** tab.
