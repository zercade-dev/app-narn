# Groq Module

## Overview

The **Groq** module translates with [Groq](https://groq.com) — fast inference for open models like Llama, Qwen, and GPT-OSS, with a free tier that suits everyday translation work. It needs a Groq API key, stored in the credential vault under the key `GROQ_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **Groq**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `GROQ_API_KEY`, paste your key as the value, enter your **vault password**, and click **Save**.

If a card later shows *Vault is locked*, click **Unlock vault** before translating.

## Choose a model

In a project's **Config** tab, pick a model from the live Groq catalog, or inherit the global default. `llama-3.3-70b-versatile` is a solid default for translation quality; smaller models like `llama-3.1-8b-instant` trade some quality for speed. **Routing rules** in the Routing tab decide which module handles each language.

## Get a Groq API key

1. Visit [console.groq.com](https://console.groq.com).
2. Sign up or log in.
3. Open **API Keys** from the console menu.
4. Create a new API key and copy it — it starts with `gsk_`.
5. Paste it into the `GROQ_API_KEY` value in the vault editor.

Groq's free tier applies per-model daily limits (no fixed numbers here — check your console for current limits), and per Groq's terms, API data isn't used to train models. Once your key is added, **NARN Freeway** automatically includes Groq's free plan when spreading translation work across your connected providers' free quotas — no extra setup needed.
