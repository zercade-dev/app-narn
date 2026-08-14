# Yapay zekâ incelemesi

## Genel bakış

Otomatik LQA denetimlerinin ötesinde, uygulama içeriğinizi incelemek için bir yapay zekâ modeli kullanabilir. İki yapay zekâ incelemesi sekmesi ve bir de elle inceleme kuyruğu vardır. Her türlü yapay zekâ incelemesi, **Genel yapılandırmada** etkinleştirilmiş bir LLM modülü ve kilidi açık bir kimlik bilgisi kasası gerektirir.

## Çeviri yapay zekâ incelemesi

**Çeviri yapay zekâ incelemesi** sekmesinde bir yapay zekâ değerlendiricisi, tamamlanmış çevirileri **doğruluk, akıcılık, terminoloji ve ton** açısından puanlar.

* En son tamamlanan çeviri çalıştırmasını değerlendirmek için **Son çalıştırmayı incele** düğmesine tıklayın (ya da **Etkinlik** sekmesinde belirli bir çalıştırmadan bir inceleme başlatın).
* İşaretlenen sonuçlar arasında adım adım ilerleyin; her verdikt kaynağı, çeviriyi, bir **puanı** ve çoğunlukla bir **öneriyi** gösterir.
* Çeviriyi değiştirmek için **Öneriyi uygula** düğmesine tıklayın, ya da hepsini tek seferde uygulamak için **Tüm önerileri uygula** seçeneğine tıklayın. Bir öneri etiketleri, yer tutucuları veya satır sonlarını düşürecekse bir uyarı görünür.

## Kaynak yapay zekâ incelemesi

**Kaynak yapay zekâ incelemesi** sekmesi **kaynak metnin kendisini** denetler — yalnızca rapor amaçlıdır ve çevirileri asla değiştirmez.

1. Çalıştırılacak denetimleri seçin: **yazım hatası**, **dil bilgisi**, **terminoloji**, **anlaşılırlık** ve **sakıncalı** içerik.
2. **Modülü** ve **modeli** seçin, isteğe bağlı olarak bulgular için **yanıt dilini** de seçin.
3. **İncelemeyi başlat** düğmesine tıklayın. Arka planda çalışır — ilerlemeyi **Etkinlik** sekmesinden izleyin.
4. Her bulguyu inceleyip **Onayla** veya **Yok say** düğmesine tıklayın; önerilen bir kaynak yeniden yazımı kopyalanabilir.

## Elle inceleme

**Elle inceleme** sekmesi, insan gözüyle yapılan bir inceleme kuyruğudur. **İnceleme gerekli** (veya **Ayrılanlar**) olarak işaretlenen çeviriler burada görünür; burada **Onayla**, **Düzenle**, **Ayır**, **Yeniden çevir** düğmelerini kullanabilir ya da referans olarak kaynağa bir **geri çeviri** isteyebilirsiniz. Klavye kısayolları işi hızlandırır: gezinmek için `↑`/`↓`, onaylamak için `a`, düzenlemek için `e`.
