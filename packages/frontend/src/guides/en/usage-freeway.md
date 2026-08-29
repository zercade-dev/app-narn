# NARN Freeway

## Overview

**NARN Freeway** is a shared pool of free-tier AI models that the app routes work to automatically — no credit card required. You still bring your own provider keys; what Freeway adds is the bookkeeping. It tracks how much free quota each provider has left, picks a model for each batch, and moves on to another one when a model is rate-limited or spent for the day.

Point routing at Freeway and you never choose a model again: there is no model or reasoning-effort setting for Freeway work, because the choice is made per batch, per language, from whatever the pool can serve right now.

## Turning it on

A brand-new project with no routing rules yet offers a **Let NARN Freeway handle everything** button on the [Routing](guide:usage-routing) tab — one click creates a catch-all rule pointing at the pool.

Otherwise, pick **NARN Freeway** like any other provider: in the Routing tab's simple selector to send the whole project to it, or as the module on a single rule in **Advanced** to use it for some languages and a paid provider for others.

Two things have to be in place first: at least one free provider needs a key stored in the [credential vault](guide:usage-vault), and the vault has to be unlocked — while it is locked, every Freeway provider shows as having no key.

## Which providers it uses

Freeway draws on the free tiers of providers you have already configured as modules. Today it knows how to use:

* **Google AI (Gemini)** — the largest free allowance, and the source of most of the pool's strongest models.
* **Groq** — fast, with a generous daily request count.
* **OpenRouter** — the free models it hosts.
* **DeepL** — its free plan's monthly character allowance, for classical machine translation.

<!-- local-only -->

* **GitHub Copilot** — if you have a Copilot subscription.

<!-- /local-only -->

A provider you haven't given a key to is simply skipped. Adding one more key widens the pool and makes it less likely a run has to wait.

## Watching the pool

The **NARN Freeway** panel on the Config screen shows the whole pool at a glance: each provider's key status, and each model's **state**, **remaining** quota, **next reset**, and recent **pass rate** per language.

Each provider also has a dropdown next to it that controls how Freeway uses it: **Automatic** lets the pool pick as usual, choosing a named instance pins Freeway to that specific account, and **Disabled** takes the provider out of the pool entirely — without switching off the module itself anywhere else. Switching a disabled provider back to Automatic (or a named instance) picks up right where it left off.

A model's state is one of:

* **Ready** — usable now.
* **Cooling down** — briefly rate-limited; it comes back on its own.
* **Exhausted for today** — the daily allowance is spent, and the panel shows when it resets.
* **Module disabled** — the key is stored but the module is switched off. The panel offers to enable it.
* **Disabled for Freeway** — you turned this provider off for the pool from its dropdown; everything else about the module is untouched.
* **No key** — nothing stored in the vault for this provider yet.
* **Bad credentials** — the key was rejected. Write a working key into the vault to clear the mark.

## When the free quota runs out

A run that exhausts the pool doesn't fail. It moves to **Waiting for free quota**, keeps the pairs it hasn't done yet, and resumes on its own once a provider's allowance resets — you can leave it and come back.

If you would rather not wait, open the run in the [Activity](guide:usage-activity) tab and use **Resume now with…** to finish the remaining pairs with a paid provider, or **Retry free pool** to try the pool again immediately.

## Quality tiers, and upgrading only what needs it

Free models are not equally good, so each one carries a **quality tier** from 1 to 4 — tier 4 being the strongest. Every translation records the tier of the model that produced it, which turns "translate it all for free" into a workable first pass:

1. Translate the whole project through Freeway at no cost.
2. In the **Translations** tab, filter by **Served below tier** to see what a weaker model handled.
3. Select those entries and use **Re-translate below tier** to redo just them with a better provider.

You end up paying only for the entries that actually needed it.

## Where else Freeway works

Freeway is not only for translation. It is available as the module for **AI review**, **source review**, and **glossary** and **category generation** too — in each case it picks the best free model for the job and hides the model and reasoning-effort settings, since there is nothing to choose. See [AI Review](guide:usage-ai-review), [Glossary](guide:usage-glossary), and [Category](guide:usage-category).
