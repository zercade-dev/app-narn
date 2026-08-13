# Kalite

## Genel bakış

**Kalite** sekmesi, girdiler her çevrildiğinde üretilen LQA (Dilsel Kalite Güvencesi) sonuçlarını toplayan bir panodur. Genel geçme oranınızı ve sorunların nerede yoğunlaştığını gösterir; böylece sorunlu alanları hızlıca bulabilirsiniz. Çeviri yaptıkça dolar — boşsa önce bir çeviri çalıştırın.

## Ne gösterir

* Tüm LQA sonuçları ve kapsadıkları girdiler genelinde **Genel geçme oranı**.
* **Dile göre geçme oranı** — hedef dil başına kalite.
* **Kaynağa göre sorunlar** — kaynak kökeni etiketine göre gruplanmış sorun türü sayıları.
* **Modüle göre kalite** — her çeviriyi üreten modüle göre gruplanmış geçme oranı ve sorunlar.

## Ayrıntıya inme

Eşleşen girdilere gitmek için herhangi bir hücreye tıklayın — pano, **Çeviriler** tablosunu etkilenen girdilere göre filtreler; böylece onları düzeltebilirsiniz.

## Denetimler nereden gelir

Her çeviri, **Yapılandırma** sekmesinin *LQA denetimleri* panelinde etkinleştirdiğiniz denetimleri (etiket eşitliği, uzunluk sınırı, taşma, sözlükçeye uyum, yasaklı terimler, regex doğrulamaları ve daha fazlası) çalıştıran LQA geçidinden geçer. **Engelleyici** denetimler geçidi geçemez ve otomatik bir yeniden denemeyi tetikleyebilir; **uyarı** denetimleri burada bloke etmeden bildirilir. Hangi denetimlerin çalışacağını ve önem derecelerini Yapılandırma'da ayarlayın.
