# Yapılandırma sekmesi

## Genel bakış

**Yapılandırma** sekmesi, seçili proje için çeviri ilkesini tutar: modül başına model seçimleri, çeviri belleği yeniden kullanımı, yığın gruplaması, kalite (LQA) denetimleri ve proje yönetimi. **Diller** ve **CSV içe/dışa aktarma** artık ayrı **Veri** sekmesinde bulunur. Sağlayıcı kimlik bilgileri burada ayarlanmaz — bunlar **kimlik bilgisi kasasında** yaşar (bkz. *Modül yapılandırma* kılavuzları ve **Genel yapılandırma**).

## Diller (Veri sekmesinde)

**Kaynak dili** ve çevrilecek **hedef dilleri** **Veri** sekmesinde ayarlayın. Etkin hedef küme diğer tüm sekmeleri yönlendirir — girdi sütunları, yönlendirme kuralları ve kalite denetimlerinin tümü ona göre şekillenir.

## CSV içe ve dışa aktarma (Veri sekmesinde)

CSV içe ve dışa aktarma da **Veri** sekmesinde bulunur:

* **CSV içe aktarma**, kaynak girdileri ve varsa mevcut çevirileri yükler. Her içe aktarmadan hemen önce otomatik olarak bir güvenlik anlık görüntüsü alınır, böylece **Yedekleme** sekmesinden geri dönebilirsiniz.
* Düzgün ayrıştırılamayan satırlar (bir tırnak işaretinin hemen ardından gelen bir virgül) sütun kaymış veri olarak yazılmak yerine atlanır ve bildirilir.
* **CSV dışa aktarma**, projeyi indirir; dilleri ve çevirmen bağlamı sütununun eklenip eklenmeyeceğini seçebilirsiniz.
* Dışa aktarmalar metni kaydedildiği gibi yazar ve = + - veya @ ile başlayan hücrelerin önüne kesme işareti eklemez. **E-tablolar için koru** seçeneğini yalnızca e-tabloda açacağınız dosyalar için açın, çünkü Miliastra düzenleyicisi bu işareti metin olarak korur. Çeviri çalıştırmaları, Need translation? değeri FALSE olan satırları atlar. Korumalı bir istemci betiği dosyası yeniden içe aktarılmamalı veya düzenleyiciye gönderilmemelidir.

### İstemci betiği dosyaları

**Text Mapping ID** sütunu olan bir CSV, istemci betiği dosyasıdır. **Ana metin**den ayrı tutulan kendi koleksiyonuna, **İstemci betiği metni**ne aktarılır; içe aktarma sayfası hangisini algıladığını gösterir.

* Her istemci dizesi kendi Text Mapping ID değeriyle tanımlanır; bu nedenle aynı İngilizce her iki koleksiyonda ve birden çok istemci satırında birleştirilmeden yer alabilir.
* İstemci dosyasını içe aktarmak ana metni asla değiştirmez, ana dosyayı içe aktarmak da istemci metnini asla değiştirmez.
* Mevcut bir anahtarın İngilizcesi değiştiğinde, her iki içe aktarma modunda da eski satır **Yetimler** sekmesine taşınır ve yeni satır dosyadaki çevirileri korur; yalnızca boş hücreleri çevrilmemiş kalır. Çevirileri aktarmak için **yeniden bağlayın**: önce aynı anahtarlı satır önerilir, üzerine yazma modu da dolu hücrelerin korunup korunmayacağını belirler.
* Bir projede istemci dizeleri olduğunda **CSV dışa aktarma** hangi koleksiyonun indirileceğini seçmenizi sağlar; istemci dışa aktarımı Text Mapping ID sütununu korur.

## Modüller ve modeller

Sağlayıcıları **Genel yapılandırmada** bir kez etkinleştirin. Burada, Yapılandırma'da, her etkin modül için proje başına **modeli** ve **akıl yürütme çabasını** seçersiniz — ya da *Genel yapılandırmadan devral* olarak bırakırsınız. Belirli bir girdi için hangi modülün gerçekten çalışacağına **yönlendirme kuralları** karar verir (bkz. *Yönlendirme* kılavuzu).

## LQA denetimleri

**LQA denetimleri** paneli, her çeviride çalışan kalite geçidini yapılandırır: tek tek denetimleri (etiket eşitliği, uzunluk sınırı, taşma, sözlükçeye uyum, yasaklı terimler, regex doğrulamaları ve daha fazlası) açıp kapatın ve her birini **Engelleyici** ya da **Uyarı** olarak ayarlayın. Engelleyici sorunlar kalite geçidini geçemez ve otomatik bir yeniden denemeyi tetikleyebilir; uyarılar yalnızca bildirilir.

## Yığın gruplaması

**Yığın gruplaması**, ilgili girdileri (kategoriye ve/veya sözlükçeye göre) aynı istekte bir arada tutar, böylece model onları bağlam içinde görür. Bir proje varsayılanı ayarlayabilir ve bunu çalıştırma başına geçersiz kılabilirsiniz.

## Proje yönetimi

**Tehlikeli bölge**, **Projeyi çoğalt** (yapılandırma ve girdiler, asla gizli bilgiler) ve **Projeyi sil** düğmelerini sunar.
