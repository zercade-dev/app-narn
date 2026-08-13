# Çeviri belleği

## Genel bakış

**Çeviri belleği** (TM), bilinen çevirilerin çalışma alanı genelinde tutulduğu bir depodur. Bir dizginin kaynak metni bellekte zaten bulunan biriyle eşleştiğinde, ücretli bir modül çağırmak yerine kayıtlı çeviri otomatik olarak yeniden kullanılır — zaman ve maliyetten tasarruf sağlar ve projeler arasında aynı metni tutarlı tutar. Kayıtlı parçalara göz atmak ve aramak için kenar çubuğundan **Çeviri belleği** görünümünü açın.

> **Çeviri belleği, her proje için varsayılan olarak devre dışıdır.** Devre dışıyken, bir projenin çevirdiği hiçbir şey belleğe yazılmaz ve kayıtlı hiçbir çeviri otomatik olarak uygulanmaz. Açmak için projenin **Yapılandırma** sekmesini açın ve **Çeviri belleği** bölümünde bir yeniden kullanım ilkesi seçin (*Devre dışı* dışında herhangi bir değer).

## Girdiler belleğe nasıl girer

* **Çeviri belleğine onayla** — **Çeviriler** sekmesinde çevirileri seçip onaylayın; bunlar güvenilir parçalar olarak kaydedilir.
* Tamamlanmış çeviriler de kaydedilir; böylece aynı kaynak metin daha sonra bunları yeniden kullanabilir.

## Yeniden kullanım ilkesi

Yeniden kullanım ilkesi (projenin **Yapılandırma** sekmesinde, **Çeviri belleği** bölümünde), aynı kaynak metin için kayıtlı bir çevirinin *ne zaman* ve *yeniden kullanılıp kullanılmayacağını* denetler. Varsayılan olarak **Devre dışıdır** (TM kapalı); diğer seçenekler — örneğin yalnızca çevredeki bağlam da eşleştiğinde yeniden kullanan **Katı (tam bağlam eşleşmesi)** — bunu açar. İlkeyi sıkılaştırmak, bir yerde doğru olan ama başka bir yerde olmayan bir çevirinin yeniden kullanılmasını önler.

## Çalıştırma başına yeniden kullanımı denetleme

**Karşılaştırma** sekmesinin *Çevir…* iletişim kutusundan bir çeviri başlattığınızda, bir bildirim kaç girdinin bellekten doldurulacağını söyler ve her girdinin yeniden taze çevrilmesini zorlamak için **Bu çalıştırmada çeviri belleğini devre dışı bırak** seçeneğini kullanabilirsiniz — modelin daha önce hafızaya alınmış metni yeniden değerlendirmesini istediğinizde işe yarar.
