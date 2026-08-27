# Sorular ve Yanıtlar

## Genel bakış

En sık karşılaşılan soruların kısa yanıtları; her biri konuyu ayrıntısıyla ele alan kılavuza yönlendiriyor. Bu liste yeni sorular geldikçe büyüyor, dolayısıyla sizinki henüz yoksa soldaki konu listesi çok daha ayrıntılı anlatıyor.

## Ne çevrilir

### Bir çalıştırma hangi girdileri çevirir, hangilerini atlar?

Yalnızca hâlâ ihtiyacı olanları. Seçtiğiniz her girdi ve her hedef dil için, o eşleşmenin henüz çevirisi yoksa — ya da açıkça **yeniden çevir** dediyseniz — çalıştırma onu çevirir. Zaten metni olan bir eşleşmeye dokunulmaz; bu yüzden çeviriyi yeniden başlatmak, tamamladığınız ya da incelediğiniz işin üzerine asla yazmaz.

Şunlardan biri geçerliyse bir girdi — ya da tek bir girdi-dil eşleşmesi — kapsam dışında kalır:

* **Zaten çevrilmiş** ve yeniden çeviri istemediniz.
* **Yok sayıldı olarak işaretlediniz.** Bu, girdiyi *tüm* yapay zekâ işlemlerinden çıkarır: çeviri, yapay zekâ incelemesi, kaynak incelemesi, sözlükçe ve kategori üretimi. Yok sayılan girdiler tabloda bir rozetle görünmeye devam eder, böylece karar her zaman görünür ve her zaman geri alınabilir kalır.
* **Yetim kalmış** — son CSV içe aktarımınızdan düşmüş ve [Yetimler](guide:usage-orphans) sekmesinde bekliyor.
* **`Çeviri gerekiyor mu? = FALSE` ile içe aktarılmış.**
* **Hedef, kaynak dilin kendisi.** O dili hedef olarak seçseniz bile bir girdi kendi kaynak diline asla çevrilmez.
* **Çevrilecek bir şey yok.** Boş metin, `3.14` ya da `100%` gibi bir sayı, `#ff8800` gibi bir onaltılık renk ya da `<b>{count}</b>` gibi yalnızca etiket ve yer tutuculardan oluşan bir dize, hiçbir sağlayıcı çağrılmadan olduğu gibi kopyalanır.

[Çeviri belleği](guide:usage-translation-memory)nden doldurulan bir girdi de sağlayıcıya hiç ulaşmaz — saklanan çeviri yeniden kullanılır. Yine de çevrilmiş sayılır.

### Zaten çevrilmiş bir şeyi yeniden çevirebilir miyim?

Evet, ama bunu istemeniz gerekir; çalıştırmalar tamamlanmış eşleşmeleri varsayılan olarak atlar. Toplu iş için *Çevir…* penceresinde **yeniden çevir** kutusunu işaretleyin; tek satır içinse [Karşılaştırma](guide:usage-compare) sekmesinde ya da elle inceleme kuyruğunda **Yeniden çevir**'i kullanın.

### Bir girdi neden kaynak metni değişmeden geri geldi?

Neredeyse her zaman çevrilecek bir şey olmadığı için — yukarıdaki listenin son maddesi. Sayılar, renkler ve saf işaretleme tanınır ve olduğu gibi kopyalanır, çünkü bir model onları ya aynen tekrarlayabilir ya da bozabilir. Bu girdiler için hiçbir sağlayıcıya bir şey gönderilmedi ve ücret işlenmedi.

## Sağlayıcılar, modeller ve yönlendirme

### Çeviride kullanılan modeli nasıl değiştiririm?

Üç düzey var ve hangisini istediğiniz, değişikliğin ne kadar geniş geçerli olacağına bağlı:

1. **Bir sağlayıcı için her yerde** — **Genel yapılandırma**'yı açın, modülü bulun ve **modelini** orada seçin. *Genel yapılandırmadan devral* ayarındaki her proje bunu izler.
2. **Tek bir proje için** — o projenin [Yapılandırma](guide:usage-config) sekmesini açın ve devralmak yerine modülün **modelini** (ve **akıl yürütme çabasını**) belirleyin.
3. **Yalnızca bazı girdiler için** — [Yönlendirme](guide:usage-routing) sekmesini açın, **Gelişmiş**'e geçin ve bir yönlendirme kuralına **model geçersiz kılma** ekleyin. Yalnızca o kuralla eşleşen girdiler bunu kullanır.

Yönlendirme sekmesinin basit görünümü model değil **sağlayıcı** seçer: o modülün zaten yapılandırılmış olduğu modeli bilerek çalıştırır.

### Farklı diller farklı sağlayıcılar kullanabilir mi?

Evet. [Yönlendirme](guide:usage-routing) sekmesini **Gelişmiş**'e alın ve dil başına bir kural ekleyin — ya da kategoriye veya girdi uzunluğuna göre. Kurallar öncelik sırasına göre değerlendirilir ve bir girdiyle eşleşen ilk kural kazanır. Hiç seçim yapmak istemiyorsanız tek bir kuralı [NARN Freeway](guide:usage-freeway)'e yöneltin ve her yığın için ücretsiz bir modeli o seçsin.

### Çeviri başlamıyor ve yönlendirme kuralı olmadığını söylüyor. Ne yapmalıyım?

Bir çalıştırma ancak içindeki her dilin gidecek bir yeri varsa başlar. Bir hedef dil hiçbir kuralla eşleşmiyorsa, hiçbir şey gönderilmeden çalıştırma reddedilir ve ileti o dili adıyla belirtir. [Yönlendirme](guide:usage-routing) sekmesini açıp onu kapsayan bir kural ekleyin — basit sağlayıcı seçici bütün dilleri tek seferde kapsar — ve çalıştırmayı yeniden başlatın.

## Çalıştırmalar, hatalar ve kurtarma

### Bazı dizeler başarısız oldu. Her şeyi baştan çalıştırmam gerekir mi?

Hayır. [Etkinlik](guide:usage-activity) sekmesinde o çalıştırma için **Başarısızları yeniden dene**'yi kullanın: yalnızca hata veren girdi-dil eşleşmelerini yeniden çalıştırır, başarılı olan her şeye dokunmaz.

### Kasayı neden tekrar açmam gerekiyor?

[Kimlik bilgisi kasası](guide:usage-vault) kalıcı olarak değil oturum başına açılır ve bir süre işlem yapılmazsa kendiliğinden yeniden kilitlenir. Açıp devam edin. Kilitlendiğinde sürmekte olan bir çalıştırma varsa, sonrasında o çalıştırmada **Başarısızları yeniden dene**'yi kullanın.

### CSV'mi yeniden içe aktardım ve bazı çeviriler kayboldu. Gittiler mi?

Hayır. Yeniden içe aktarım bir girdiyi artık içermiyorsa, o girdinin çevirileri silinmek yerine [Yetimler](guide:usage-orphans) sekmesinde saklanır. Çevirileri taşımak için yetimi onun yerini alan girdiyle **Yeniden bağla**; hedefte yalnızca boş diller doldurulur, dolayısıyla hiçbir şeyin üzerine yazılmaz. Ayrıca her içe aktarmadan hemen önce otomatik bir anlık görüntü alınır, böylece projenin tamamını [Yedekleme](guide:usage-backup) sekmesinden geri alabilirsiniz.
