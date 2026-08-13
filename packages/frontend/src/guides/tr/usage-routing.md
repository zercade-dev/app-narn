# Yönlendirme sekmesi

## Genel bakış

**Yönlendirme** sekmesi, hangi modülün ve modelin hangi girdiyi işleyeceğine karar verir. Tek bir sağlayıcı seçicisiyle açılır: bir sağlayıcı seçin, projedeki her girdi ona gider. Çoğu projenin ihtiyacı olan tek şey budur.

Birden fazla hedefe mi ihtiyacınız var? Sekmeyi **Gelişmiş** moduna geçirin; hedef dile, kategoriye veya girdi uzunluğuna göre yönlendirmenin farklılaşabildiği ve birkaç adlandırılmış kural grubu tutabildiğiniz tam kural oluşturucu görünür. Sekme, ikisinden en son hangisini kullandığınızı hatırlar. Yönlendirmesi tek bir sağlayıcıdan zengin olan bir proje, hangi modu seçmiş olursanız olun her zaman kural oluşturucuyu gösterir — mevcut bir kurulum sizden asla gizlenmez.

Her iki durumda da bu sekme yalnızca girdilerin *nasıl* gönderileceğine karar verir. Çeviriler **Çeviriler** veya **Karşılaştırma** sekmesinden başlatılır.

## Yönlendirme kuralları

Kurallar **Gelişmiş** görünümünde bulunur. Öncelik sırasına göre değerlendirilir; bir girdiyle eşleşen ilk kural kazanır. Her kural şunlara göre eşleşebilir:

* **Kaynaklar** — içe aktarılan girdilerin kaynak/köken etiketleri.
* **Girdi uzunluk sınırı** — yalnızca belirli bir karakter sayısında veya altındaki girdilere uygulanır.
* **Hedef dil** ve **kategoriler**.

Eşleşen girdiler için kural, **modülü** (ve isteğe bağlı bir **model** ile **akıl yürütme çabası** geçersiz kılmasını) artı isteğe bağlı istem ipuçlarını (karakter, ton, cinsiyet, notlar) ayarlar. **Kural ekle** ile kurallar ekleyin; her değişiklik siz yaptıkça sizin için kaydedilir, bu yüzden hatırlanacak bir **Kaydet** düğmesi yoktur. Birkaç adlandırılmış **kural grubu** tutabilir ve aralarında geçiş yapabilirsiniz (bir çalıştırma sürerken geçiş kilitlidir).

## Yığın gruplaması

Yönlendirme sekmesinde ayrıca bir **Yığın gruplaması** denetimi de vardır — Yapılandırma sekmesinde gösterilen proje başına aynı varsayılan, buna eşlik eden bir **Yığın boyutu sınırını yok say** anahtarıyla birlikte. Bu, çeviri, değerlendirme ve kaynak inceleme çalıştırmaları boyunca ilgili girdileri aynı sağlayıcı isteğinde tutar.

## Bir çeviri başlatma

1. **Çeviriler** veya **Karşılaştırma** sekmesinde girdileri seçin.
2. Oradan **Çevir…** iletişim kutusunu açın — yeniden çeviri, bellek ve çalıştırma başına gruplama seçenekleri sunar, ardından çalıştırmayı başlatır.
3. İlerlemeyi, yeniden denemeleri ve başarısızlıkları **Etkinlik** sekmesinden izleyin.
