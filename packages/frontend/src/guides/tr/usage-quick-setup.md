# Hızlı kurulum

## Genel bakış

Yeni bir proje için tam yol: sağlayıcıları etkinleştirin, girdilerinizi içe aktarın, sözlükçeleri ve yönlendirmeyi yapılandırın, çevirin ve inceleyin. *(Optional)* olarak işaretlenen adımlar kaliteyi artırır ama ilk çeviri için gerekli değildir — ilk geçişte bunları atlayın ve daha sonra geri dönün.

## 1. Sağlayıcıları etkinleştirme ve kimlik bilgilerini saklama

1. **Genel yapılandırmayı** açın ve istediğiniz her sağlayıcı için (Anthropic, OpenAI, DeepL vb.) **bir modül etkinleştirin**. Bir modülün birden çok **adlandırılmış örneği** olabilir — aynı sağlayıcının farklı anahtarlar veya varsayılanlarla iki yapılandırması için yararlıdır.
2. Sağlayıcı kimlik bilgileri şifrelenmiş **kimlik bilgisi kasasında** saklanır — ilk kullanımda kurun ve oturum başına bir kez kilidini açın. Nasıl çalıştığını görmek için *Kimlik bilgisi kasası* kılavuzuna bakın.
3. Modül veya örnek başına bir **model** (ve isteğe bağlı bir **akıl yürütme çabası**) seçin. Daha ucuz modeller daha kötü çevirir, bu yüzden kendi dengenizi bulmak için biraz deneme yanılma bekleyin. **Akıl yürütme çabasına** dikkat edin — düşünen modellerde faturalandırmayı hızla katlayabilir.

## 2. Projeyi oluşturma ve girdileri içe aktarma

Bir proje oluşturun, **kaynak dilini** ayarlayın, ardından kaynak girdilerinizi (ve dosyanın zaten sahip olduğu çevirileri) yüklemek için **Veri** sekmesindeki **CSV içe aktarma** seçeneğini kullanın.

## 3. *(Optional)* Önce kaynak metninizi inceleyin

Çevirmeden önce kaynak dil üzerinde **Kaynak yapay zekâ incelemesi** çalıştırın — burada yazım hatalarını ve belirsiz ifadeleri düzeltmek, sonradan yapılan her çeviriye fayda sağlar. Bir düzeltme, zaten çevirisi olan bir girdiyi değiştirirse eski çeviriler **Yetimler** sekmesine düşer — isteğe bağlı yeniden çeviriyle bunları **yeniden bağlayın**.

## 4. *(Optional)* Sözlükçeleri etkinleştirin

**Sözlükçe** sekmesinde, projenize uygulanan sözlükçeleri etkinleştirin. Otomatik uygulama, terimleri **büyük/küçük harf duyarsız, tam sözcük** olarak eşleştirir — çekimli biçimler (çoğullar, çekimler) yakalanmaz. **DeepL** ile mi çeviriyorsunuz? Sözlükçeleri **DeepL'e gönder** (sağ üstte) ile ona gönderin ve düzenledikten sonra yeniden gönderin.

## 5. Yönlendirmeyi kurma

**Yönlendirme** sekmesini açın ve açıldığı seçiciden sağlayıcınızı seçin — bu, projedeki her girdiyi ona gönderir; tek sağlayıcılı bir kurulumun ihtiyacı olan tek şey budur. Dil, kategori veya girdi uzunluğuna göre farklı sağlayıcılar mı istiyorsunuz? Bunun yerine **Gelişmiş** moduna geçin ve orada **yönlendirme kuralları** ekleyin. Seçiminiz her iki durumda da sizin için kaydedilir. Bu adım zorunludur: eşleşen kuralı olmayan bir girdi, *“eşleşen yönlendirme kuralı yok”* hatasıyla çeviride başarısız olur.

## 6. *(Optional)* Kendi içeriğinizden sözlükçeler oluşturma

Toplu çeviriden önce sözlükçelerinizi büyütün: terimleri elle ekleyin, tüm kaynak üzerinde **Sözlükçe üret** çalıştırın, ya da — daha hedefli olarak — **Çeviriler** sekmesinde iyi aday girdiler seçip **Seçimden sözlükçe üret** kullanın (mevcut çevirileri dâhil edin). Burada yetkin bir model kullanın; sözlükçe kalitesi, sonradan çevrilen her şeyde katlanarak etki eder.

## 7. *(Optional)* Önce Karşılaştırma sekmesinde kaliteyi iyileştirin

Tam bir çeviri çalıştırmasından önce, kişisel olarak değerlendirebileceğiniz bir dili ince ayarlamak için **Karşılaştırma** sekmesini kullanın:

- Çeviri doğru okunana kadar her girdinin **bağlamını** (karakter, ton, notlar) ve sözlükçelerini iyileştirin. Bağlam dil başına değil girdi başına saklanır, bu yüzden bu çalışma otomatik olarak diğer her dile de yansır.
- Girdi girdi ilerlediğiniz için burada ucuz veya ücretsiz bir model yeterlidir — örneğin, geçici olarak yönlendirmesi ona işaret eden kendi **modül örneği** olarak eklenmiş ücretsiz bir Gemini anahtarı (bkz. *Google AI (Gemini)* kılavuzu). Ücretsiz katmanın günlük bir sınırı vardır, bu yüzden gruplanmış istekleri tercih edin.
- Sonuçlardan memnun musunuz? Toplu hâlde de tutarlı olduğunu doğrulamak için aynı ayarlarla tüm yığını bir kez çevirin.

## 8. Çevirin

Gerçek çeviriyi çalıştırmanın iki yolu vardır:

- **Çeviriler** — girdileri seçip her hedef dili tek seferde kapsamak için **Seçilenleri çevir** düğmesini kullanın.
- **Karşılaştırma** — tek seferde tek bir dil, isteğe bağlı olarak zaten incelenmiş bir dili **referans** bağlamı olarak kullanarak.

Tam bir proje için genellikle tek seferde tek bir dil, incelenmiş bir referans diliyle birlikte en iyi sonucu verir: sonraki yapay zekâ incelemesi tek bir dile odaklanmış kalır. İlerlemeyi **Etkinlik** sekmesinden izleyin.

Yığınlama varsayılan olarak otomatiktir; birçok kısa girdisi olan küçük bir proje için, özel bir yığın boyutu olarak **0** (tek istekte tüm dil) yetkin bir modelle daha iyi çalışabilir.

## 9. Çalıştırmayı inceleyin

Birini seçin:

- **Etkinlik** sekmesinden tamamlanan çalıştırma için bir **yapay zekâ incelemesi** tetikleyin.
- **Elle inceleme** veya **Karşılaştırma** sekmesinde elle inceleyin.
- Her şeyi olduğu gibi onaylayıp sonra inceleyin.
