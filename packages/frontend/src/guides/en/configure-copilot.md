# GitHub Copilot Module

## Overview

The **Copilot** module translates through GitHub Copilot. It authenticates with a GitHub token from an account that has an **active Copilot subscription**, stored in the credential vault under the key `GITHUB_TOKEN`.

## Add your token to the credential vault

Provider credentials live in an encrypted **credential vault**, not in plain config. You unlock the vault once per session with a password.

1. Open **Global Config** from the sidebar.
2. If you haven't set up the vault yet, create it: choose a vault password (you will reuse it each session) and unlock it.
3. Under **Enable a module**, select **GitHub Copilot**. When a required key is missing, the vault editor opens on the right key automatically — otherwise click **Manage credential vault**.
4. In the vault editor, add a credential: pick the key `GITHUB_TOKEN`, paste your token as the value, enter your **vault password**, and click **Save**.

If the model list shows *No models available*, the token is missing, invalid, or the vault is locked — unlock the vault or check your GitHub token, then reopen the card.

## Get a GitHub token

Use a **fine-grained** personal access token so it grants only Copilot access and nothing else.

1. Visit [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens).
2. Click **Generate new token** (fine-grained tokens are the default).
3. Give it a name (e.g. "Translator-Copilot") and set an **Expiration**.
4. Under **Permissions → Account permissions**, find **Copilot Requests** and set it to **Read-only**. No other permissions are needed.
5. Click **Generate token** and copy it immediately — GitHub shows it only once.
6. Paste it into the `GITHUB_TOKEN` value in the vault editor.

The account behind the token must have an active Copilot subscription for translations to succeed.
