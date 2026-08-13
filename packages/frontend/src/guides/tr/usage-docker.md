# Docker

## Genel bakış

Uygulama, bir Docker imajı ve **iki hizmeti** ayağa kaldıran bir `docker-compose.yml` dosyası olarak dağıtılır: `app` (hem API'yi hem de derlenmiş arayüzü tek bir bağlantı noktasından sunar) ve **zorunlu** bir `postgres` veritabanı. Depolama her yerde Postgres kullanır, bu yüzden sunucu onsuz açılmaz. Varsayılan olarak `docker compose up`, GHCR'den yayımlanan `:main` imajını (`ghcr.io/zercade-dev/narn:main`) çeker ve onun yanında resmî bir Postgres 17 başlatır.

## Ön koşullar

* **Docker** ve **Docker Compose** kurulu olmalıdır.
* Uygulama imajı yalnızca **amd64** için derlenmiştir. Apple Silicon'da yine de çalışır — Docker onu emülasyon yoluyla yürütür.
* İmaj hesabınız için özelse ilk çekmeden önce bir kez `docker login ghcr.io` çalıştırın (`read:packages` iznine sahip bir token ile).

## Çalıştırma

`docker-compose.yml` dosyasını içeren klasörden — NARN kaynağının en üst düzeyinden:

```
docker compose up
```

Compose önce Postgres'i başlatır, sağlık kontrolünü bekler, ardından uygulamayı başlatır. Uygulama sağlıklı hâle geldiğinde `http://localhost:3001` adresinden açın.

Yığın, verilerinizin yeniden başlatmalarda kalıcı olması için iki adlandırılmış birim kullanır:

* **`translator-db`** — **projelerinizin** ve **çeviri belleğinizin** yaşadığı Postgres veri dizini.
* **`translator-data`** — yerel kasa dosyası artı proje başına yedekler ve otomatik anlık görüntüler.

Postgres hiçbir ana makine bağlantı noktası yayımlamaz ve dahili bir Docker ağında bulunur, bu yüzden yalnızca uygulama kapsayıcısı tarafından erişilebilir.

## Ana makine bağlantı noktasını değiştirme

Kapsayıcı, Docker içinde her zaman **3001** bağlantı noktasını dinler. Compose dosyası bunu makinenizde aynı bağlantı noktasına eşler:

```
ports:
  - "127.0.0.1:3001:3001"
```

3001 bağlantı noktası zaten kullanımdaysa eşlemenin **sol (ana makine) tarafını** — ikinci iki noktadan önceki kısmı — değiştirin. Örneğin, 8000 bağlantı noktasından sunmak için:

```
ports:
  - "127.0.0.1:8000:3001"
```

Ardından uygulamaya `http://localhost:8000` adresinden erişilebilir.

`HOST` veya `PORT` ortam değişkenlerini **değiştirmeyin** — bunlar kapsayıcı içi değişkenlerdir (sunucu, Docker'ın ona yönlendirme yapabilmesi için kapsayıcı içinde `0.0.0.0:3001` adresine bağlanır). Yalnızca `ports` eşlemesinin ana makine tarafı, makinenizdeki adresi denetler.

`127.0.0.1:` öneki, uygulamayı loopback'e bağlı tutarak tek kullanıcılı, yalnızca yerel duruşu korur. Uygulamayı dışa açmak için kasıtlı bir nedeniniz olmadıkça bunu olduğu gibi bırakın.
