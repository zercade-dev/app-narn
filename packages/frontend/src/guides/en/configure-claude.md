# Anthropic (Claude) Module

## Overview

The **Claude** module translates with Anthropic's Claude models. It needs an Anthropic API key, stored in the credential vault under the key `ANTHROPIC_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **Anthropic (Claude)**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `ANTHROPIC_API_KEY`, paste your key as the value, enter your **vault password**, and click **Save**. Saving re-encrypts the vault.

If a card later shows *Vault is locked*, click **Unlock vault** before translating.

## Choose a model

In a project's **Config** tab, pick a Claude model (and optional reasoning effort), or leave it to inherit the global default. **Routing rules** in the Routing tab decide which module handles each language.

## Get an Anthropic API key

1. Visit [console.anthropic.com](https://console.anthropic.com).
2. Sign up or log in.
3. Open the **API keys** section.
4. Click **Create Key** and copy it.
5. Paste it into the `ANTHROPIC_API_KEY` value in the vault editor.
