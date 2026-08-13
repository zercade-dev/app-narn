# OpenRouter Modülü

## Genel bakış

**OpenRouter** modülü, [OpenRouter](https://openrouter.ai) ile çeviri yapar — birçok sağlayıcının (Anthropic, OpenAI, Google, Meta ve daha fazlası) modellerine yönlendirme yapan tek bir API. Bir OpenRouter API anahtarına ihtiyaç duyar; bu anahtar kimlik bilgisi kasasında `OPENROUTER_API_KEY` anahtarı altında saklanır.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **OpenRouter** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `OPENROUTER_API_KEY` anahtarını seçin, anahtarınızı değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın.

Bir kart daha sonra *Kasa kilitli* gösterirse çeviri yapmadan önce **Kasanın kilidini aç** düğmesine tıklayın.

## Model seçimi

Bir projenin **Yapılandırma** sekmesinde, canlı OpenRouter kataloğundan bir model seçin — her girdi, token başına fiyatını ve bağlam uzunluğunu gösterir ve yalnızca metin üretme modelleri listelenir. Model kimlikleri sağlayıcı önekiyle yazılır (örneğin `anthropic/claude-sonnet-4.5` veya `openai/gpt-4o-mini`); yeni bir slug'ı doğrudan da yazabilirsiniz. Yönlendirme sekmesindeki **yönlendirme kuralları**, hangi modülün hangi dili işleyeceğine karar verir.

## Bir OpenRouter API anahtarı alma

1. [openrouter.ai](https://openrouter.ai) adresini ziyaret edin.
2. Kaydolun veya oturum açın.
3. Hesap menünüzden **Keys** bölümünü açın.
4. Yeni bir API anahtarı oluşturun ve kopyalayın.
5. Kasa düzenleyicisinde `OPENROUTER_API_KEY` değerine yapıştırın.

Not: metniniz OpenRouter'a gönderilir ve OpenRouter'ın koşulları ile ilgili sağlayıcının veri politikası altında, seçtiğiniz modelin sağlayıcısına yönlendirilir.
