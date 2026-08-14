# DeepL Modülü

## Genel bakış

**DeepL** modülü profesyonel bir nöral makine çevirisi sağlar. LLM modüllerinin aksine klasik bir MT'dir ve tutarlı terminoloji için proje sözlükçelerini DeepL'e gönderebilir. Anahtarı kimlik bilgisi kasasında `DEEPL_API_KEY` altında saklanır.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **DeepL** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `DEEPL_API_KEY` anahtarını seçin, kimlik doğrulama anahtarınızı değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın.

DeepL adlandırılmış örnekleri desteklemez — tek bir DeepL modülü vardır.

## Sözlükçe kullanma

DeepL, çeviri sırasında bir sözlükçe uygulayabilir. **Sözlükçe** sekmesinde terimler oluşturun, ardından bunları yüklemek için **DeepL'e gönder** düğmesini kullanın. Bir sözlükçe gönderimden sonra değişirse sekme *Yeniden gönderim gerekli* gösterir — DeepL'i güncellemek için yeniden gönderin.

## Bir DeepL API anahtarı alma

1. [deepl.com/account](https://www.deepl.com/account) adresini ziyaret edin.
2. Ücretsiz veya Pro bir API hesabı için kaydolun.
3. **Account Settings** bölümünü açın ve **API Key** kısmını bulun.
4. Kimlik doğrulama anahtarınızı kopyalayın.
5. Kasa düzenleyicisinde `DEEPL_API_KEY` değerine yapıştırın.
