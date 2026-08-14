# GitHub Copilot 模块

## 概述

**Copilot** 模块通过 GitHub Copilot 进行翻译。它使用一个来自拥有**有效 Copilot 订阅**账户的 GitHub 令牌进行身份验证，保存在保险库中，密钥名为 `GITHUB_TOKEN`。

## 将令牌添加到保险库

服务商凭据保存在经过加密的**保险库**中，而非明文配置里。您每个会话只需用密码解锁一次。

1. 从侧边栏打开**全局配置**。
2. 如果您还没有设置保险库，先创建一个：选择一个保险库密码（每次会话都要重复使用它），然后解锁。
3. 在**启用模块**下，选择 **GitHub Copilot**。当缺少必需的密钥时，保险库编辑器会自动打开到对应的密钥项——否则请点击**管理凭据保险库**。
4. 在保险库编辑器中，添加一项凭据：选择密钥 `GITHUB_TOKEN`，将您的令牌粘贴为值，输入您的**保险库密码**，然后点击**保存**。

如果模型列表显示"没有可用模型"，说明令牌缺失、无效，或保险库已锁定——请解锁保险库或检查您的 GitHub 令牌，然后重新打开该卡片。

## 获取 GitHub 令牌

请使用**细粒度**个人访问令牌，使其仅授予 Copilot 访问权限，不包含其他权限。

1. 访问 [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)。
2. 点击 **Generate new token**（细粒度令牌为默认选项）。
3. 给它起个名字（例如"Translator-Copilot"），并设置一个 **Expiration**。
4. 在 **Permissions → Account permissions** 下，找到 **Copilot Requests**，将其设为 **Read-only**。不需要其他任何权限。
5. 点击 **Generate token** 并立即复制它——GitHub 只会显示一次。
6. 将其粘贴到保险库编辑器中 `GITHUB_TOKEN` 的值里。

令牌背后的账户必须拥有有效的 Copilot 订阅，翻译才能成功。
