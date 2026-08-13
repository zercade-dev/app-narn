# Pseudo Test

## Genel bakış

**Pseudo Test** gerçek bir dil değildir. Kaynak metninizi kasıtlı olarak bozulmuş bir sürüme dönüştüren, ücretsiz ve çevrimdışı bir QA dilidir; böylece bunu oyununuza yükleyip — tek bir gerçek çeviri var olmadan önce — hangi dizgilerin arayüzü bozduğunu görebilirsiniz.

Hiçbir maliyeti yoktur, API anahtarı gerektirmez ve hiçbir zaman bir sağlayıcıya bir şey göndermez.

## Ne üretir

`Save changes`, `⟦Şàvé çhàñgéş~~~~⟧` gibi bir şey hâline gelir. Aynı anda üç şey olur ve her biri farklı bir hata sınıfını ortaya çıkarır:

* **Aksanlı harfler.** Her harf, aksanlı bir benzeriyle değiştirilir. Oyununuzda hâlâ düz İngilizce olarak görünen herhangi bir metin, hiçbir zaman dizgi tablosuna alınmamıştır — sabit kodlanmıştır ve hiçbir çevirmen ona asla ulaşamaz.
* **Doldurma.** Metin, orijinal uzunluğunun yaklaşık 1,4 katına `~` karakterleriyle uzatılır; bu, Almanca gibi uzun çıkan dilleri simüle eder. Düğmelerini taşan, kötü sarılan veya düzeni iten etiketler hemen ortaya çıkar.
* **Köşeli parantezler.** Sonuç `⟦…⟧` içine sarılır. Ekranda köşeli parantezlerden biri eksikse o dizgi kırpılıyor demektir.

Metninizdeki yer tutucular ve biçimlendirme etiketleri değişmeden geçer; bu yüzden bunlardan biri bozuk çıkarsa bu bir düzen sorunu değil, bildirilmeye değer bir hatadır.

## Kullanma

1. **Veri** sekmesinde, *Hedef diller* altında **Pseudo Test** seçeneğini işaretleyip kaydedin.
2. Her zamanki gibi bir çeviri çalıştırın. Pseudo Test girdileri her zaman yerleşik pseudo üretici tarafından işlenir — etkinleştirilecek hiçbir şey, yazılacak bir yönlendirme kuralı ve hiçbir maliyet yoktur. Ücretli sağlayıcılarınız bu dizgileri asla görmez.
3. Gerçek çevirileriniz güvendedir: Pseudo Test metni kendi sütununda saklanır ve başka bir dilin üzerine asla yazamaz.

## Oyununuza aktarma

Dışa aktarma kartında **Pseudo metni şu dil olarak dışa aktar** seçeneğini şu anda yayımlamadığınız bir dile — örneğin Almanca'ya — ayarlayın, ardından dosyayı indirip oyunda o dil seçiliyken yükleyin. Seçilen dilin sütunu, yalnızca o tek indirme için Pseudo Test metniyle doldurulur; kayıtlı hiçbir şey değişmez ve gerçek çeviriler bir sonraki dışa aktarmanızda hâlâ oradadır.

Testi bitirdiğinizde, ikame seçeneğini tekrar **Değiştirme yok** olarak ayarlayıp yeniden dışa aktarın. Normal bir dışa aktarma hiçbir zaman bir Pseudo Test sütunu içermez — pseudo metni oyununuza yalnızca yukarıdaki ikame yoluyla ulaşır — bu yüzden Pseudo Test'i açık bırakmak, gönderdiğiniz dosyaları etkilemez.

## Ne zaman kullanılır

Herhangi bir çeviri sipariş etmeden önce erkenden bir pseudo geçişi çalıştırın. Bulduğu her düzen hatası, on beş dil geldikten sonra on beş kez yerine bir kez düzelttiğiniz bir hatadır.
