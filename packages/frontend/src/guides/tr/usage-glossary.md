# Sözlükçe sekmesi

## Genel bakış

**Sözlükçe** sekmesi terminolojiyi tutarlı tutar. Bir proje birden çok sözlükçe barındırabilir; her biri, hedef dil başına bir çeviriye sahip kaynak terimlerin listesidir. Sözlükçeler girdilerle otomatik olarak eşleştirilir ve eşleşen terimler çeviri sırasında modele geçirilir.

## Sözlükçeler ve terimler

* **Yeni sözlükçe** ile bir sözlükçe oluşturun; daha sonra yeniden adlandırın veya silin.
* Bir sözlükçeyi **etkinleştirin** veya **devre dışı bırakın** — devre dışı bir sözlükçe, içe aktarma ve çeviri sırasında yok sayılır.
* Terimleri bir **kaynak**, dil başına bir **çeviri** ve isteğe bağlı **notlarla** ekleyin.
* Bir terimi asla çevrilmemesi gerektiğinde (marka adları, kodlar) **sabit** olarak işaretleyin. Sabit terimler çeviri sırasında maskelenir; böylece değişmeden geçer.

Bazı sözlükçeler **salt okunurdur** (genel düzeyde yönetilir) ve burada düzenlenemeden terim katkısında bulunur.

## İçe ve dışa aktarma

Terimleri **CSV** veya **TBX** biçiminden içe aktarın — bir önizleme, uygulamadan önce kaç terimin eklendiğini, güncellendiğini veya çakıştığını gösterir. Sözlükçeyi tekrar **CSV** veya **TBX** olarak dışa aktarın.

## Yapay zekâ ile üretme

* **Sözlükçe üret**, kaynak metni tarar ve tekrar eden adlardan ve özel terimlerden sözlükçeler önerir. Arka planda çalışır — **Etkinlik** sekmesinden izleyin ve oluşturmadan önce önerileri inceleyin. Modelin bunları tekrarlamaması için mevcut sözlükçeleri “zaten bilinen” olarak geçebilirsiniz.
* **Çeviri üret**, çevirisi hâlâ eksik olan terimler için hedef çevirileri doldurur.

## DeepL

DeepL ile çeviri yapıyorsanız sözlükçe terimlerini yüklemek için **DeepL'e gönder** düğmesini kullanın. Gönderilen bir sözlükçeyi düzenledikten sonra sekme *Yeniden gönderim gerekli* gösterir — DeepL'i güncellemek için yeniden gönderin.

## Girdi başına denetim

**Çeviriler** sekmesinden, tek bir girdi için hangi sözlükçelerin **etkin** olacağını seçebilirsiniz.
