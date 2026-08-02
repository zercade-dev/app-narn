# Generic AI Module

## Overview

The **Generic AI** module connects to any OpenAI-compatible API — a hosted provider or a locally-run server (e.g. Ollama, LM Studio, vLLM). Its key is stored in the credential vault under `GENERIC_API_KEY`.

**The API key is optional.** It only matters for endpoints that require authentication (most paid cloud providers). A local server such as Ollama or LM Studio needs no real key — but the vault still requires the `GENERIC_API_KEY` field to be non-empty, so store any placeholder (e.g. `local`) to satisfy it.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **Generic AI**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `GENERIC_API_KEY`, enter your **vault password**, and click **Save**. For a paid endpoint, paste the real API key as the value. For a local server that needs no auth, the key is optional — just store any non-empty placeholder (e.g. `local`).

## Run more than one endpoint with instances

Generic AI supports **named instances**, so you can register several endpoints (for example one cloud provider and one local server) side by side. Use **Add another Generic AI instance** in Global Config. Each instance gets its own derived vault key — for example `GENERIC_API_KEY__MY-OLLAMA` — that you fill in the same vault editor.

## Choose endpoint and model

Set the base URL and model for the module (or each instance) in its Global Config settings, then pick the model per project in the **Config** tab. **Routing rules** in the Routing tab decide which module or instance handles each language.

## Get credentials

For a **local server** (Ollama, LM Studio, vLLM), no account or key is needed — just the base URL (e.g. `http://localhost:11434/v1`) and a placeholder in the `GENERIC_API_KEY` field.

For a **paid provider**, steps depend on the provider: create an account, obtain the API base URL and key, and confirm the endpoint speaks the OpenAI chat-completions format before entering the key into the vault.
