# Yedekleme sekmesi

## Genel bakış

**Yedekleme** sekmesi bir projeyi — yapılandırmasını, girdilerini ve sözlükçesini — doğrulanabilir bir `.zip` arşivine paketler. Her dosya sağlama toplamıyla korunur ve geri yüklemede herhangi bir şey yazılmadan önce bu sağlama toplamları doğrulanır.

## Yedek oluşturma

1. Bir proje seçin.
2. **Yedekleme** sekmesini açın.
3. **Yedek oluştur** düğmesine tıklayın.
4. Yeni arşiv, indirebileceğiniz **Kayıtlı yedekler** listesinde görünür.

## Otomatik yedekler

Uygulama, elle alınan yedeklerin yanında listelenen güvenlik anlık görüntülerini de sizin için otomatik olarak alır:

* **Bir CSV içe aktarmadan önce** — içe aktarmadan hemen önce alınan bir anlık görüntü.
* **Bir yeniden çeviriden önce** — girdilerin üzerine yazılmadan hemen önce alınan bir anlık görüntü.

Genel yapılandırma, **Proje başına en fazla yedek** sayısını belirler (varsayılan 10); bunun ötesindeki eski yedekler budanır.

## Geri yükleme

1. **Yedekten geri yükleme** bölümünde bir `.zip` dosyası seçin (ya da kayıtlı yedeklerden birini seçin).
2. Uygulama sağlama toplamlarını doğrular ve bir önizleme gösterir (proje, dosyalar, oluşturulma zamanı).
3. Onaylayın. Geri yükleme, projenin mevcut yapılandırmasının, girdilerinin ve sözlükçesinin üzerine yazar — bu geri alınamaz, bu yüzden emin değilseniz önce yeni bir yedek oluşturun.

## Silme

Bir arşivi sunucudan kalıcı olarak kaldırmak için kayıtlı herhangi bir yedekte **Sil** düğmesini kullanın.
