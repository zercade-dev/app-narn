# GitHub Copilot Modülü

## Genel bakış

**Copilot** modülü, GitHub Copilot üzerinden çeviri yapar. **Etkin bir Copilot aboneliği** olan bir hesaba ait bir GitHub belirteciyle kimlik doğrular; bu belirteç kimlik bilgisi kasasında `GITHUB_TOKEN` anahtarı altında saklanır.

## Belirtecinizi kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **GitHub Copilot** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `GITHUB_TOKEN` anahtarını seçin, belirtecinizi değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın.

Model listesi *Kullanılabilir model yok* gösterirse belirteç eksik, geçersiz veya kasa kilitlidir — kasanın kilidini açın veya GitHub belirtecinizi kontrol edin, ardından kartı yeniden açın.

## Bir GitHub belirteci alma

Yalnızca Copilot erişimi verip başka hiçbir şeye izin vermeyen ince ayarlı bir kişisel erişim belirteci kullanın.

1. [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens) adresini ziyaret edin.
2. **Generate new token** düğmesine tıklayın (ince ayarlı belirteçler varsayılandır).
3. Bir ad verin (örn. “Translator-Copilot”) ve bir **Expiration** (son kullanma) süresi belirleyin.
4. **Permissions → Account permissions** altında **Copilot Requests** seçeneğini bulun ve **Read-only** olarak ayarlayın. Başka izin gerekmez.
5. **Generate token** düğmesine tıklayın ve belirteci hemen kopyalayın — GitHub onu yalnızca bir kez gösterir.
6. Kasa düzenleyicisinde `GITHUB_TOKEN` değerine yapıştırın.

Belirtecin ait olduğu hesabın, çevirilerin başarılı olması için etkin bir Copilot aboneliğine sahip olması gerekir.
