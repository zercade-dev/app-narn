# Google AI (Gemini) Modülü

## Genel bakış

**Google AI** modülü, Google'ın Gemini modelleriyle çeviri yapar. Bir Google AI Studio API anahtarına ihtiyaç duyar; bu anahtar kimlik bilgisi kasasında `GOOGLE_API_KEY` anahtarı altında saklanır.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **Google AI (Gemini)** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `GOOGLE_API_KEY` anahtarını seçin, anahtarınızı değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın.

Bir kart daha sonra *Kasa kilitli* gösterirse çeviri yapmadan önce **Kasanın kilidini aç** düğmesine tıklayın.

## Model seçimi

Bir projenin **Yapılandırma** sekmesinde bir Gemini modeli (ve isteğe bağlı bir akıl yürütme çabası) seçin, ya da genel varsayılanı devralmasına izin verin. Yönlendirme sekmesindeki **yönlendirme kuralları**, hangi modülün hangi dili işleyeceğine karar verir. Düşünen modeller, karakter sayısına göre büyük token sayıları bildirir, bu yüzden maliyet tahminleri yüksek görünebilir.

## Bir Google API anahtarı alma

1. [ai.google.dev](https://ai.google.dev) adresini ziyaret edip **Get API key** düğmesine tıklayın, ya da doğrudan [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) adresine gidin.
2. **Create API key** düğmesine tıklayın ve projenizi seçin.
3. Oluşturulan anahtarı kopyalayın.
4. Kasa düzenleyicisinde `GOOGLE_API_KEY` değerine yapıştırın.
