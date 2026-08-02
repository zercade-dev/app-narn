# DeepSeek Module

## Overview

The **DeepSeek** module translates with the DeepSeek API. It needs a DeepSeek API key, stored in the credential vault under the key `DEEPSEEK_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **DeepSeek**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `DEEPSEEK_API_KEY`, paste your key as the value, enter your **vault password**, and click **Save**.

If a card later shows *Vault is locked*, click **Unlock vault** before translating.

## Choose a model

In a project's **Config** tab, pick a DeepSeek model (and optional reasoning effort), or inherit the global default. **Routing rules** in the Routing tab decide which module handles each language.

## Get a DeepSeek API key

1. Visit [platform.deepseek.com](https://platform.deepseek.com).
2. Sign up or log in.
3. Open your **API keys** section.
4. Create a new API key and copy it.
5. Paste it into the `DEEPSEEK_API_KEY` value in the vault editor.
