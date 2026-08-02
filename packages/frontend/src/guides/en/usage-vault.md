# Credential Vault

## Overview

Provider API keys are never kept in plain config files or environment variables. They live in the **credential vault** — an encrypted store that must be unlocked before any translation or AI review can use a credential. You unlock once per browser session; credentials are decrypted in memory only.

<!-- local-only -->
## Password vault (self-hosted)

On a self-hosted install the vault is an encrypted local file. The first unlock creates it: the password you choose becomes the vault password, and every credential you save re-encrypts the file. The password itself is never stored — without it, the file cannot be decrypted. Unlock from **Global Config**, or from any *Vault is locked* card.
<!-- /local-only -->

## Device-bound vault (cloud)

On the cloud version the vault is stored **encrypted on the server**, and decrypting it requires two factors:

- Your **password** — never stored anywhere, on the server or the device.
- A **per-device key** — generated in your browser when you enroll a device and kept only on that device.

When you unlock, both factors travel over the encrypted connection and are combined server-side to derive the decryption key **in memory, for your session only**. Neither factor nor the derived key is ever written to server storage — what's stored is only the encrypted vault itself. So stored server data alone can't reveal your credentials, and a leaked password alone isn't enough either: unlocking also requires one of your enrolled devices.

If Global Config shows a **Go to the vault page** button instead of a password prompt, you're on the device-bound vault — the Vault page handles setup, device enrollment, unlocking, credential edits, and password changes.

## Good to know

- A device you've never used before must be **enrolled** on the Vault page before it can unlock.
- If you lose your password (or, on cloud, every enrolled device), the vault contents cannot be recovered — you'll have to set the vault up again and re-enter your provider keys.
- Anything the app logs passes through redaction, so credential values never appear in logs.
