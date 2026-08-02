# Google AI (Gemini) Module

## Overview

The **Google AI** module translates with Google's Gemini models. It needs a Google AI Studio API key, stored in the credential vault under the key `GOOGLE_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **Google AI (Gemini)**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `GOOGLE_API_KEY`, paste your key as the value, enter your **vault password**, and click **Save**.

If a card later shows *Vault is locked*, click **Unlock vault** before translating.

## Choose a model

In a project's **Config** tab, pick a Gemini model (and optional reasoning effort), or inherit the global default. **Routing rules** in the Routing tab decide which module handles each language. Thinking models report large token counts relative to characters, so cost estimates can look high.

## Get a Google API key

1. Visit [ai.google.dev](https://ai.google.dev) and click **Get API key**, or go directly to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Click **Create API key** and select your project.
3. Copy the generated key.
4. Paste it into the `GOOGLE_API_KEY` value in the vault editor.
