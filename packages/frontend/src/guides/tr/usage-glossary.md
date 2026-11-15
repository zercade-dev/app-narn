# Sözlükçe sekmesi

## Genel bakış

**Sözlükçe** sekmesi terminolojiyi tutarlı tutar. Bir proje birden çok sözlükçe barındırabilir; her biri, hedef dil başına bir çeviriye sahip kaynak terimlerin listesidir. Sözlükçeler girdilerle otomatik olarak eşleştirilir ve eşleşen terimler çeviri sırasında modele geçirilir.

## Sözlükçeler ve terimler

* **Yeni sözlükçe** ile bir sözlükçe oluşturun; daha sonra yeniden adlandırın veya silin.
* Bir sözlükçeyi **etkinleştirin** veya **devre dışı bırakın** — devre dışı bir sözlükçe, içe aktarma ve çeviri sırasında yok sayılır.
* Terimleri bir **kaynak**, dil başına bir **çeviri** ve isteğe bağlı **notlarla** ekleyin.
* Bir terimin, karakter ya da marka adı gibi, sözlükçede yazıldığı haliyle çıkması gerektiğinde onu **sabit** olarak işaretleyin — aşağıdaki *Sabit terimler* bölümüne bakın.
* Bir sözlükçenin iki sekmesi vardır: **Terimler** terimlerini, **Eşleşmeler** ise onları içeren girdileri listeler; orada sözlükçeyi girdilere atayabilir ya da kaldırabilirsiniz.

Bazı sözlükçeler **salt okunurdur** (genel düzeyde yönetilir) ve burada düzenlenemeden terim katkısında bulunur.

## Sabit terimler

* Sabit bir terim **çeviri motoruna asla gönderilmez**. NARN çeviriden önce onu bir yer tutucuyla değiştirir, ardından yerine sözlükçedeki çeviriyi koyar; böylece *Diluc* gibi bir karakter adı her zaman sözlükçede yazıldığı gibi çıkar.
* **Büyük-küçük harf önemlidir.** Yalnızca terimle tam olarak aynı yazılan metin korunur: *Razor* (karakter) korunur, *a razor* korunmaz. Diğer yazımlar, motorun adı gündelik sözcükten ayırabilmesi için ad olarak işaretlenmiş sıradan bir sözlükçe ipucu olarak gönderilir.
* **Motor sözcüğü değiştiremez.** Terimi hiç görmediği için onu çekimleyemez ya da diğer sözcükleri ona uyduramaz: Rusça, Korece veya Türkçe gibi dillerde sabit bir ad her zaman yalın haliyle görünür. Sabiti, değişmemesi gereken adlar ve kodlar için kullanın.
* Gündelik sözcük de olan adları normal terim olarak bırakın; başlıklar ve etiketler onları sık sık büyük harfle yazar (*Gaming Settings*). Uygulamayla gelen **Genshin Characters** sözlükçesinde Gaming, Amber, Razor, Sucrose ve Prune dışındaki tüm adlar sabittir.

## İçe ve dışa aktarma

Terimleri **CSV** veya **TBX** biçiminden içe aktarın — bir önizleme, uygulamadan önce kaç terimin eklendiğini, güncellendiğini veya çakıştığını gösterir. Sözlükçeyi tekrar **CSV** veya **TBX** olarak dışa aktarın.

## Yapay zekâ ile üretme

* **Sözlükçe üret**, kaynak metni tarar ve tekrar eden adlardan ve özel terimlerden sözlükçeler önerir. Arka planda çalışır — **Etkinlik** sekmesinden izleyin ve oluşturmadan önce önerileri inceleyin. Modelin bunları tekrarlamaması için mevcut sözlükçeleri “zaten bilinen” olarak geçebilirsiniz.
* **Çeviri üret**, çevirisi hâlâ eksik olan terimler için hedef çevirileri doldurur.

## DeepL

DeepL ile çeviri yapıyorsanız sözlükçe terimlerini yüklemek için **DeepL'e gönder** düğmesini kullanın. Gönderilen bir sözlükçeyi düzenledikten sonra sekme *Yeniden gönderim gerekli* gösterir — DeepL'i güncellemek için yeniden gönderin.

## Girdi başına denetim

**Çeviriler** sekmesinden, tek bir girdi için hangi sözlükçelerin **etkin** olacağını seçebilirsiniz.
