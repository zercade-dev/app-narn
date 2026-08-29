# NARN Freeway

## Genel bakış

**NARN Freeway**, uygulamanın işi otomatik olarak yönlendirdiği, ücretsiz kademedeki yapay zekâ modellerinden oluşan ortak bir havuzdur — kredi kartı gerekmez. Sağlayıcı anahtarlarını yine siz getirirsiniz; Freeway'in eklediği şey muhasebedir. Her sağlayıcıda ne kadar ücretsiz kota kaldığını izler, her yığın için bir model seçer ve bir model hız sınırına takıldığında ya da günlük hakkı bittiğinde bir diğerine geçer.

Yönlendirmeyi Freeway'e çevirdiğinizde bir daha model seçmezsiniz: Freeway işinin model ya da akıl yürütme çabası ayarı yoktur, çünkü seçim her yığın ve her dil için, havuzun o an sunabildikleri arasından yapılır.

## Açmak

Henüz yönlendirme kuralı olmayan yepyeni bir proje, [Yönlendirme](guide:usage-routing) sekmesinde **Her şeyi NARN Freeway'e bırak** düğmesini sunar — tek tıklamayla ücretsiz havuza işaret eden kapsayıcı bir kural oluşur.

Bunun dışında **NARN Freeway**'i başka herhangi bir sağlayıcı gibi seçin: bütün projeyi ona göndermek için Yönlendirme sekmesinin basit seçicisinden, ya da bazı dillerde onu bazılarında ücretli bir sağlayıcıyı kullanmak için **Gelişmiş**'te tek bir kuralın modülü olarak.

Önce iki şey yerinde olmalı: en az bir ücretsiz sağlayıcının anahtarı [kimlik bilgisi kasası](guide:usage-vault)nda saklanmalı ve kasa açık olmalı — kasa kilitliyken her Freeway sağlayıcısı anahtarsız görünür.

## Hangi sağlayıcıları kullanır

Freeway, hâlihazırda modül olarak yapılandırdığınız sağlayıcıların ücretsiz kademelerinden yararlanır. Bugün kullanmayı bildikleri:

* **Google AI (Gemini)** — en geniş ücretsiz hak ve havuzdaki en güçlü modellerin çoğunun kaynağı.
* **Groq** — hızlı, cömert bir günlük istek sayısıyla.
* **OpenRouter** — barındırdığı ücretsiz modeller.
* **DeepL** — klasik makine çevirisi için ücretsiz planının aylık karakter hakkı.

<!-- local-only -->

* **GitHub Copilot** — Copilot aboneliğiniz varsa.

<!-- /local-only -->

Anahtar vermediğiniz bir sağlayıcı yalnızca atlanır. Bir anahtar daha eklemek havuzu genişletir ve bir çalıştırmanın beklemek zorunda kalma olasılığını düşürür.

## Havuzu izlemek

Yapılandırma ekranındaki **NARN Freeway** paneli bütün havuzu tek bakışta gösterir: her sağlayıcının anahtar durumu ve her modelin **Durum**u, **Kalan** kotası, **Sonraki sıfırlama**sı ve dil bazında son **Geçme oranı**.

Her sağlayıcının yanında, Freeway'in onu nasıl kullanacağını denetleyen bir açılır menü de vardır: **Otomatik** havuzun her zamanki gibi seçmesini sağlar, adlandırılmış bir örnek seçmek Freeway'i o hesaba sabitler, **Devre dışı** ise sağlayıcıyı havuzdan tamamen çıkarır — modülü başka hiçbir yerde kapatmadan. Devre dışı bir sağlayıcıyı yeniden Otomatik'e (ya da adlandırılmış bir örneğe) çevirmek, kaldığı yerden devam eder.

Bir modelin durumu şunlardan biridir:

* **Hazır** — şimdi kullanılabilir.
* **Soğuyor** — kısa süreliğine hız sınırında; kendiliğinden geri döner.
* **Bugünlük tükendi** — günlük hak harcandı ve panel ne zaman sıfırlanacağını gösterir.
* **Modül devre dışı** — anahtar saklı ama modül kapalı. Panel açmayı önerir.
* **Freeway için devre dışı** — bu sağlayıcıyı açılır menüsünden havuz için devre dışı bıraktınız; modülün geri kalanı etkilenmez.
* **Anahtar yok** — bu sağlayıcı için kasada henüz bir şey yok.
* **Kimlik bilgileri hatalı** — anahtar reddedildi. İşareti kaldırmak için kasaya çalışan bir anahtar yazın.

## Ücretsiz kota bittiğinde

Havuzu tüketen bir çalıştırma başarısız olmaz. **Ücretsiz kota bekleniyor** durumuna geçer, henüz yapmadığı eşleşmeleri saklar ve bir sağlayıcının hakkı sıfırlanır sıfırlanmaz kendiliğinden devam eder — bırakıp sonra dönebilirsiniz.

Beklemek istemiyorsanız çalıştırmayı [Etkinlik](guide:usage-activity) sekmesinde açın ve kalan eşleşmeleri ücretli bir sağlayıcıyla bitirmek için **Şimdi başka modülle sürdür…**'ü, havuzu hemen yeniden denemek için **Ücretsiz havuzu yeniden dene**'yi kullanın.

## Kalite kademeleri ve yalnızca gerekeni yükseltmek

Ücretsiz modeller eşit derecede iyi değildir, bu yüzden her biri 1'den 4'e bir **kalite kademesi** taşır; 4 en güçlüsüdür. Her çeviri, onu üreten modelin kademesini kaydeder ve bu, “hepsini ücretsiz çevir”i işe yarar bir ilk geçişe dönüştürür:

1. Projenin tamamını Freeway üzerinden ücretsiz çevirin.
2. **Çeviriler** sekmesinde **Kademenin altında** filtresiyle daha zayıf bir modelin neleri üstlendiğini görün.
3. O girdileri seçip **Kademenin altında yeniden çevir** ile yalnızca onları daha iyi bir sağlayıcıyla yineleyin.

Sonuçta yalnızca gerçekten ihtiyaç duyan girdiler için ödeme yaparsınız.

## Freeway başka nerede çalışır

Freeway yalnızca çeviri için değildir. **Yapay zekâ incelemesi**, **kaynak incelemesi** ve **sözlükçe** ile **kategori üretimi** için de modül olarak kullanılabilir — her durumda iş için en iyi ücretsiz modeli kendi seçer, seçilecek bir şey kalmadığından model ve akıl yürütme çabası ayarlarını gizler. Bkz. [Yapay zekâ incelemesi](guide:usage-ai-review), [Sözlükçe](guide:usage-glossary) ve [Kategori](guide:usage-category).
