# GitHub Copilot 模組

## 總覽

**Copilot** 模組透過 GitHub Copilot 進行翻譯。它會用來自**已訂閱 Copilot** 帳號的 GitHub 權杖進行驗證，該權杖儲存在憑證保險庫中，金鑰名稱為 `GITHUB_TOKEN`。

## 把權杖加入憑證保險庫

供應商憑證存放在加密的**憑證保險庫**中，而不是明文設定檔。您每個工作階段只需用密碼解鎖保險庫一次。

1. 從側邊欄開啟**全域設定**。
2. 如果您還沒設定過保險庫，先建立它：選擇一組保險庫密碼（之後每個工作階段都會重複使用），然後解鎖。
3. 在**啟用模組**底下，選取 **GitHub Copilot**。如果缺少必要的金鑰，保險庫編輯器會自動開啟到對應的欄位——否則請按一下**管理憑證保險庫**。
4. 在保險庫編輯器中新增憑證：選擇金鑰 `GITHUB_TOKEN`，貼上您的權杖作為值，輸入您的**保險庫密碼**，然後按一下**儲存**。

如果模型清單顯示「沒有可用的模型」，代表權杖缺失、無效，或保險庫已鎖定——請解鎖保險庫或檢查您的 GitHub 權杖，然後重新開啟這張卡片。

## 取得 GitHub 權杖

請使用**細粒度**（fine-grained）個人存取權杖，讓它只授予 Copilot 存取權，不多不少。

1. 前往 [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)。
2. 按一下 **Generate new token**（細粒度權杖是預設選項）。
3. 取一個名稱（例如「Translator-Copilot」），並設定**到期時間**（Expiration）。
4. 在 **Permissions → Account permissions** 底下，找到 **Copilot Requests**，並將它設為 **Read-only**。不需要其他任何權限。
5. 按一下 **Generate token** 並立即複製它——GitHub 只會顯示這一次。
6. 貼到保險庫編輯器的 `GITHUB_TOKEN` 值欄位中。

權杖所屬的帳號必須有有效的 Copilot 訂閱，翻譯才會成功。
