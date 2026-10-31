# Activity Tab

## Overview

The **Activity** tab is the control center for background jobs. Every long-running task surfaces here: **translation** runs, **AI review** (translation and source), **glossary generation**, and **category generation**. Runs are queued and serialized per project, so you can line several up and watch them work through.

## Reading a run

Each run shows its **type**, **status** (Queued, Running, Paused, Completed, Failed, or Cancelled), progress, and an estimated **cost**. Costs are module-reported estimates derived from each model's price per million tokens, so thinking models can show large token totals relative to characters. Use **Show details** to see exactly what a run translated, any retries, and character/token usage. You can copy a run's id for reference.

If a model keeps failing with the same error, the run also shows a warning line that names the model, how many failures there have been so far, what the provider said, and whether those requests moved to another model or will be retried. A run can finish successfully and still show this line, because another model may have translated the strings. The provider's message is stored with the run and can quote part of the text it was sent. Rate limits and passing outages don't trigger it.

## Managing the queue

* **Pause** / **Resume** a run, or **Start now** to jump a queued run ahead.
* **Move up** / **Move down** to reorder the queue.
* **Cancel** a run that is queued or in progress.

## Recovering and reviewing

* If some strings failed, **Retry failed** re-runs just those.
* On a completed translation run, start an **AI review** directly from the run — choose the module and model (it defaults to the ones used for the translation), then open the verdicts in the **Translation AI review** tab.
