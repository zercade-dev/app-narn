# OpenAI (GPT) Module

## Overview

The **GPT** module translates with OpenAI's models. It needs an OpenAI API key, stored in the credential vault under the key `OPENAI_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **OpenAI (GPT)**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `OPENAI_API_KEY`, paste your key as the value, enter your **vault password**, and click **Save**.

If a card later shows *Vault is locked*, click **Unlock vault** before translating.

## Choose a model

In a project's **Config** tab, pick a GPT model (and optional reasoning effort), or inherit the global default. **Routing rules** in the Routing tab decide which module handles each language.

## Get an OpenAI API key

1. Visit [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys).
2. Sign up or log in.
3. Click **Create new secret key**.
4. Copy the key (it is shown only once).
5. Paste it into the `OPENAI_API_KEY` value in the vault editor.
