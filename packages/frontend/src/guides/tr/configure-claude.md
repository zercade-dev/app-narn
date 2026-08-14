# Anthropic (Claude) Modülü

## Genel bakış

**Claude** modülü, Anthropic'in Claude modelleriyle çeviri yapar. Bir Anthropic API anahtarına ihtiyaç duyar; bu anahtar kimlik bilgisi kasasında `ANTHROPIC_API_KEY` anahtarı altında saklanır.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **Anthropic (Claude)** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `ANTHROPIC_API_KEY` anahtarını seçin, anahtarınızı değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın. Kaydetmek, kasayı yeniden şifreler.

Bir kart daha sonra *Kasa kilitli* gösterirse çeviri yapmadan önce **Kasanın kilidini aç** düğmesine tıklayın.

## Model seçimi

Bir projenin **Yapılandırma** sekmesinde bir Claude modeli (ve isteğe bağlı bir akıl yürütme çabası) seçin, ya da genel varsayılanı devralmasına izin verin. Yönlendirme sekmesindeki **yönlendirme kuralları**, hangi modülün hangi dili işleyeceğine karar verir.

## Bir Anthropic API anahtarı alma

1. [console.anthropic.com](https://console.anthropic.com) adresini ziyaret edin.
2. Kaydolun veya oturum açın.
3. **API keys** bölümünü açın.
4. **Create Key** düğmesine tıklayın ve anahtarı kopyalayın.
5. Kasa düzenleyicisinde `ANTHROPIC_API_KEY` değerine yapıştırın.
