# Groq Modülü

## Genel bakış

**Groq** modülü, [Groq](https://groq.com) ile çeviri yapar — Llama, Qwen ve GPT-OSS gibi açık modeller için hızlı çıkarım sağlayan, günlük çeviri işleri için uygun bir ücretsiz katmana sahip bir hizmet. Bir Groq API anahtarına ihtiyaç duyar; bu anahtar kimlik bilgisi kasasında `GROQ_API_KEY` anahtarı altında saklanır.

## Anahtarınızı kimlik bilgisi kasasına ekleme

Sağlayıcı kimlik bilgileri düz yapılandırmada değil, şifrelenmiş bir **kimlik bilgisi kasasında** saklanır. Kasanın kilidini oturum başına bir kez parolayla açarsınız.

1. Kenar çubuğundan **Genel yapılandırmayı** açın.
2. Kasayı henüz kurmadıysanız oluşturun: bir kasa parolası seçin (her oturumda yeniden kullanacaksınız) ve kilidini açın.
3. **Bir modül etkinleştir** altında **Groq** seçeneğini seçin. Gerekli bir anahtar eksikse kasa düzenleyicisi otomatik olarak ilgili anahtarla açılır — aksi hâlde **Kimlik bilgisi kasasını yönetme** düğmesine tıklayın.
4. Kasa düzenleyicisinde bir kimlik bilgisi ekleyin: `GROQ_API_KEY` anahtarını seçin, anahtarınızı değer olarak yapıştırın, **kasa parolanızı** girin ve **Kaydet** düğmesine tıklayın.

Bir kart daha sonra *Kasa kilitli* gösterirse çeviri yapmadan önce **Kasanın kilidini aç** düğmesine tıklayın.

## Model seçimi

Bir projenin **Yapılandırma** sekmesinde, canlı Groq kataloğundan bir model seçin veya genel varsayılanı devralın. `llama-3.3-70b-versatile`, çeviri kalitesi için sağlam bir varsayılandır; `llama-3.1-8b-instant` gibi daha küçük modeller hız karşılığında biraz kaliteden ödün verir. Yönlendirme sekmesindeki **yönlendirme kuralları**, hangi modülün hangi dili işleyeceğine karar verir.

## Bir Groq API anahtarı alma

1. [console.groq.com](https://console.groq.com) adresini ziyaret edin.
2. Kaydolun veya oturum açın.
3. Konsol menüsünden **API Keys** bölümünü açın.
4. Yeni bir API anahtarı oluşturun ve kopyalayın — `gsk_` ile başlar.
5. Kasa düzenleyicisinde `GROQ_API_KEY` değerine yapıştırın.

Groq'un ücretsiz katmanı model başına günlük sınırlar uygular (burada sabit sayılar yok — güncel sınırlar için konsolünüzü kontrol edin) ve Groq'un koşullarına göre API verileri modelleri eğitmek için kullanılmaz. Anahtarınız eklendikten sonra, **NARN Freeway** bağlı sağlayıcılarınızın ücretsiz kotaları arasında çeviri işini dağıtırken Groq'un ücretsiz planını otomatik olarak dahil eder — ek bir kurulum gerekmez.
