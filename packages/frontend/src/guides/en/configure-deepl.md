# DeepL Module

## Overview

The **DeepL** module provides professional neural machine translation. Unlike the LLM modules it is classical MT, and it can push project glossaries to DeepL for consistent terminology. Its key is stored in the credential vault under `DEEPL_API_KEY`.

## Add your key to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **DeepL**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `DEEPL_API_KEY`, paste your authentication key as the value, enter your **vault password**, and click **Save**.

DeepL does not support named instances — there is a single DeepL module.

## Using glossaries

DeepL can apply a glossary during translation. Build terms in the **Glossary** tab, then use **Push to DeepL** to upload them. If a glossary changes after a push, the tab shows *Re-push required* — push again to update DeepL.

## Get a DeepL API key

1. Visit [deepl.com/account](https://www.deepl.com/account).
2. Sign up for a Free or Pro API account.
3. Open **Account Settings** and find the **API Key** section.
4. Copy your authentication key.
5. Paste it into the `DEEPL_API_KEY` value in the vault editor.
