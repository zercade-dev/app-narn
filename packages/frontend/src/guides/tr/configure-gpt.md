# OpenAI (GPT) Modülü

## Genel bakış

**GPT** modülü, OpenAI'nin modelleriyle çeviri yapar. Bir OpenAI API anahtarına ihtiyaç duyar; bu anahtar kimlik bilgisi kasasında `OPENAI_API_KEY` anahtarı altında saklanır.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **OpenAI (GPT)** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `OPENAI_API_KEY` anahtarını seçin, anahtarınızı değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın.

Bir kart daha sonra *Kasa kilitli* gösterirse çeviri yapmadan önce **Kasanın kilidini aç** düğmesine tıklayın.

## Model seçimi

Bir projenin **Yapılandırma** sekmesinde bir GPT modeli (ve isteğe bağlı bir akıl yürütme çabası) seçin, ya da genel varsayılanı devralmasına izin verin. Yönlendirme sekmesindeki **yönlendirme kuralları**, hangi modülün hangi dili işleyeceğine karar verir.

## Bir OpenAI API anahtarı alma

1. [platform.openai.com/account/api-keys](https://platform.openai.com/account/api-keys) adresini ziyaret edin.
2. Kaydolun veya oturum açın.
3. **Create new secret key** düğmesine tıklayın.
4. Anahtarı kopyalayın (yalnızca bir kez gösterilir).
5. Kasa düzenleyicisinde `OPENAI_API_KEY` değerine yapıştırın.
