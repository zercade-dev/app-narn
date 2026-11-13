# Hızlı kurulum

## Genel bakış

NARN'da yeni misiniz? Aşağıdaki kısa yol, sizi beş adımda sıfırdan dışa aktarılmış bir çeviriye götürür. Uygulama içi rehberli kurulum aynı adımlarda size eşlik eder; atlayıp daha sonra kaldığınız yerden devam edebilirsiniz — kenar çubuğundaki **Kuruluma devam** sizi bıraktığınız yerden sürdürür, ayrıca bu Kılavuz'dan yeniden başlatabilirsiniz. Kısa yoldan sonraki her şey, daha fazla denetim istediğiniz zaman içindir.

## Kısa yol

1. **Kasa parolanızı oluşturun.** Sağlayıcı anahtarlarınız bununla şifrelenir — bkz. [Kimlik bilgisi kasası](guide:usage-vault) kılavuzu. Bulut sürümünde 1. ve 2. adımlar kasa sayfasında birlikte yapılır.
2. **Bir ücretsiz anahtar ekleyin.** Google AI anahtarı en kolay başlangıçtır — [aistudio.google.com/apikey](https://aistudio.google.com/apikey) adresinden alın ya da **Kendi sağlayıcımı kullan** seçeneğini seçin. Ardından [NARN Freeway](guide:usage-freeway) sizin için ücretsiz modelleri seçer.
3. **Bir proje oluşturun ve metninizi içe aktarın.** Bir proje oluşturun, ardından **Veri** sekmesinde kaynak dili ve çevrilecek dilleri seçin, sonra **CSV içe aktarma** işlevini kullanın.
4. **Çevirin.** **Çeviriler** sekmesinde tüm girdileri seçin ve **Çevir**'e tıklayın. NARN Freeway sizin için ücretsiz modelleri seçer; ilerlemeyi **Etkinlik** sekmesinden izleyin.
5. **Dışa aktarın.** Çevrilmiş dosyayı projeden indirin.

Yeni kullanıcılar, yalnızca Yapılandırma, Veri, Çeviriler ve Etkinlik sekmelerini (ayrıca Kılavuz, Ayarlar ve **Sağlayıcı anahtarları**) gösteren **Basit mod** ile başlar. Üst çubuktan ya da Ayarlar'dan istediğiniz zaman **Basit** ve **Gelişmiş** arasında geçiş yapabilirsiniz.

## Daha fazlasını istediğinizde

Bu adımlar **Gelişmiş mod**'da yer alır ve kaliteyi artırır ya da size daha ince denetim sağlar. *(Optional)* işaretli adımlar ilk çeviri için gerekli değildir — atlayın, daha sonra dönün. Gelişmiş modda Yönlendirme, Sözlükçe, Kalite, Karşılaştırma veya Çeviri yapay zekâ incelemesi sekmelerini ilk kez açtığınızda kısa bir tur önerilir; herhangi bir turu bu Kılavuz'dan yeniden başlatabilir, önerileri Ayarlar'dan kapatabilirsiniz.

## Daha fazla sağlayıcı ve kimlik bilgisi ekleme

1. **Genel yapılandırmayı** açın ve istediğiniz her sağlayıcı için (Anthropic, OpenAI, DeepL vb.) **Bir modül etkinleştir** listesinden **bir modül etkinleştirin** — DeepL adıyla listelenir, yapay zekâ sağlayıcıları ise sağlayıcının ilk örneğini oluşturan **Başka bir … örneği ekle…** olarak görünür. Bir modülün birden çok **adlandırılmış örneği** olabilir — aynı sağlayıcının farklı anahtarlar veya varsayılanlarla iki yapılandırması için yararlıdır.
2. Sağlayıcı kimlik bilgileri şifrelenmiş **kimlik bilgisi kasasında** saklanır — ilk kullanımda kurun ve oturum başına bir kez kilidini açın. Nasıl çalıştığını görmek için *Kimlik bilgisi kasası* kılavuzuna bakın.
3. Modül veya örnek başına bir **model** (ve isteğe bağlı bir **akıl yürütme çabası**) seçin. Daha ucuz modeller daha kötü çevirir, bu yüzden kendi dengenizi bulmak için biraz deneme yanılma bekleyin. **Akıl yürütme çabasına** dikkat edin — düşünen modellerde faturalandırmayı hızla katlayabilir.

## *(Optional)* Önce kaynak metninizi inceleyin

Çevirmeden önce kaynak dil üzerinde **Kaynak yapay zekâ incelemesi** çalıştırın — burada yazım hatalarını ve belirsiz ifadeleri düzeltmek, sonradan yapılan her çeviriye fayda sağlar. Bir düzeltme, zaten çevirisi olan bir girdiyi değiştirirse eski çeviriler **Yetimler** sekmesine düşer — isteğe bağlı yeniden çeviriyle bunları **yeniden bağlayın**.

## *(Optional)* Sözlükçeleri etkinleştirin

**Sözlükçe** sekmesinde, projenize uygulanan sözlükçeleri etkinleştirin. Otomatik uygulama, terimleri **büyük/küçük harf duyarsız, tam sözcük** olarak eşleştirir — çekimli biçimler (çoğullar, çekimler) yakalanmaz. **DeepL** ile mi çeviriyorsunuz? Sözlükçeleri **DeepL'e gönder** (sağ üstte) ile ona gönderin ve düzenledikten sonra yeniden gönderin.

## Yönlendirmeyi kurma

**Yönlendirme** sekmesini açın ve açıldığı seçiciden sağlayıcınızı seçin — bu, projedeki her girdiyi ona gönderir; tek sağlayıcılı bir kurulumun ihtiyacı olan tek şey budur. Dil, kategori veya girdi uzunluğuna göre farklı sağlayıcılar mı istiyorsunuz? Bunun yerine **Gelişmiş** moduna geçin ve orada **yönlendirme kuralları** ekleyin. Seçiminiz her iki durumda da sizin için kaydedilir. Hiç kuralı olmayan bir proje her şeyi NARN Freeway üzerinden gönderir; bu yüzden bu adım başlangıçta isteğe bağlıdır. Projede kurallar olduğunda, hiçbirine uymayan bir girdi *“eşleşen yönlendirme kuralı yok”* hatasıyla çeviride başarısız olur.

## *(Optional)* Kendi içeriğinizden sözlükçeler oluşturma

Toplu çeviriden önce sözlükçelerinizi büyütün: terimleri elle ekleyin, tüm kaynak üzerinde **Sözlükçe üret** çalıştırın, ya da — daha hedefli olarak — **Çeviriler** sekmesinde iyi aday girdiler seçip **Seçimden sözlükçe üret** kullanın (mevcut çevirileri dâhil edin). Burada yetkin bir model kullanın; sözlükçe kalitesi, sonradan çevrilen her şeyde katlanarak etki eder.

## *(Optional)* Önce Karşılaştırma sekmesinde kaliteyi iyileştirin

Tam bir çeviri çalıştırmasından önce, kişisel olarak değerlendirebileceğiniz bir dili ince ayarlamak için **Karşılaştırma** sekmesini kullanın:

- Çeviri doğru okunana kadar her girdinin **bağlamını** (karakter, ton, notlar) ve sözlükçelerini iyileştirin. Bağlam dil başına değil girdi başına saklanır, bu yüzden bu çalışma otomatik olarak diğer her dile de yansır.
- Girdi girdi ilerlediğiniz için burada ucuz veya ücretsiz bir model yeterlidir — örneğin, geçici olarak yönlendirmesi ona işaret eden kendi **modül örneği** olarak eklenmiş ücretsiz bir Gemini anahtarı (bkz. *Google AI (Gemini)* kılavuzu). Ücretsiz katmanın günlük bir sınırı vardır, bu yüzden gruplanmış istekleri tercih edin.
- Sonuçlardan memnun musunuz? Toplu hâlde de tutarlı olduğunu doğrulamak için aynı ayarlarla tüm yığını bir kez çevirin.

## Toplu çeviri

Gerçek çeviriyi çalıştırmanın iki yolu vardır:

- **Çeviriler** — girdileri seçip her hedef dili tek seferde kapsamak için **Seçilenleri çevir** düğmesini kullanın.
- **Karşılaştırma** — tek seferde tek bir dil, isteğe bağlı olarak zaten incelenmiş bir dili **referans** bağlamı olarak kullanarak.

Tam bir proje için genellikle tek seferde tek bir dil, incelenmiş bir referans diliyle birlikte en iyi sonucu verir: sonraki yapay zekâ incelemesi tek bir dile odaklanmış kalır. İlerlemeyi **Etkinlik** sekmesinden izleyin.

Yığınlama varsayılan olarak otomatiktir; birçok kısa girdisi olan küçük bir proje için, özel bir yığın boyutu olarak **0** (tek istekte tüm dil) yetkin bir modelle daha iyi çalışabilir.

## Çalıştırmayı inceleyin

Birini seçin:

- **Etkinlik** sekmesinden tamamlanan çalıştırma için bir **yapay zekâ incelemesi** tetikleyin.
- **Elle inceleme** veya **Karşılaştırma** sekmesinde elle inceleyin.
- Her şeyi olduğu gibi onaylayıp sonra inceleyin.
