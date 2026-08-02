# OpenRouter Module

## Overview

The **OpenRouter** module translates with [OpenRouter](https://openrouter.ai) — a single API that routes to models from many vendors (Anthropic, OpenAI, Google, Meta, and more). It needs an OpenRouter API key, stored in the credential vault under the key `OPENROUTER_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **OpenRouter**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `OPENROUTER_API_KEY`, paste your key as the value, enter your **vault password**, and click **Save**.

If a card later shows *Vault is locked*, click **Unlock vault** before translating.

## Choose a model

In a project's **Config** tab, pick a model from the live OpenRouter catalog — each entry shows its per-token pricing and context length, and only text-generation models are listed. Model ids are vendor-prefixed (for example `anthropic/claude-sonnet-4.5` or `openai/gpt-4o-mini`); you can also type a new slug directly. **Routing rules** in the Routing tab decide which module handles each language.

## Get an OpenRouter API key

1. Visit [openrouter.ai](https://openrouter.ai).
2. Sign up or log in.
3. Open **Keys** from your account menu.
4. Create a new API key and copy it.
5. Paste it into the `OPENROUTER_API_KEY` value in the vault editor.

Note: your text is sent to OpenRouter and routed onward to the vendor of the model you select, under OpenRouter's terms and that vendor's data policy.
