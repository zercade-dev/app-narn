# Generic AI Modülü

## Genel bakış

**Generic AI** modülü, OpenAI ile uyumlu herhangi bir API'ye bağlanır — barındırılan bir sağlayıcı veya yerelde çalışan bir sunucu (ör. Ollama, LM Studio, vLLM). Anahtarı kimlik bilgisi kasasında `GENERIC_API_KEY` altında saklanır.

**API anahtarı isteğe bağlıdır.** Yalnızca kimlik doğrulama gerektiren uç noktalar için önemlidir (çoğu ücretli bulut sağlayıcısı). Ollama veya LM Studio gibi yerel bir sunucu gerçek bir anahtara ihtiyaç duymaz — ama kasa yine de `GENERIC_API_KEY` alanının boş olmamasını gerektirir, bu yüzden bunu karşılamak için herhangi bir yer tutucu (ör. `local`) saklayın.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **Generic AI** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `GENERIC_API_KEY` anahtarını seçin, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın. Ücretli bir uç nokta için gerçek API anahtarını değer olarak yapıştırın. Kimlik doğrulama gerektirmeyen yerel bir sunucu için anahtar isteğe bağlıdır — yalnızca boş olmayan bir yer tutucu (ör. `local`) saklayın.

## Örneklerle birden fazla uç nokta çalıştırma

Generic AI, **adlandırılmış örnekleri** destekler; böylece birkaç uç noktayı (örneğin bir bulut sağlayıcısı ve bir yerel sunucu) yan yana kaydedebilirsiniz. Genel yapılandırmada **Başka bir Generic AI örneği ekle…** seçeneğini kullanın. Her örnek kendi türetilmiş kasa anahtarını alır — örneğin `GENERIC_API_KEY__MY-OLLAMA` — bunu da aynı kasa düzenleyicisinde doldurursunuz.

## Uç nokta ve model seçimi

Modülün (veya her örneğin) temel URL'sini ve modelini kendi Genel yapılandırma ayarlarında belirleyin, ardından modeli proje başına **Yapılandırma** sekmesinde seçin. Yönlendirme sekmesindeki **yönlendirme kuralları**, hangi modülün veya örneğin hangi dili işleyeceğine karar verir.

## Kimlik bilgileri edinme

**Yerel bir sunucu** (Ollama, LM Studio, vLLM) için hesap veya anahtar gerekmez — yalnızca temel URL (ör. `http://localhost:11434/v1`) ve `GENERIC_API_KEY` alanında bir yer tutucu yeterlidir.

**Ücretli bir sağlayıcı** için adımlar sağlayıcıya göre değişir: bir hesap oluşturun, API temel URL'sini ve anahtarını edinin, ardından anahtarı kasaya girmeden önce uç noktanın OpenAI sohbet tamamlama (chat-completions) biçimini konuştuğunu doğrulayın.
